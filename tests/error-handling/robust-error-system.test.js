/**
 * Comprehensive Test Suite for Robust Error Handling System
 * 
 * Tests all error handling improvements:
 * - Error classes and structured errors
 * - Input validation
 * - Resource management
 * - Async error handling
 * - Webhook error handling
 * - Attestation verification
 * - Content resolution
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  KGenError,
  InitializationError,
  ValidationError,
  FileSystemError,
  RaceConditionError,
  WebhookError,
  AttestationError,
  InputValidator,
  ResourceManager,
  AsyncErrorHandler,
  WebhookHandler,
  AttestationVerifier,
  ContentResolver
} from '../../src/error-handling/robust-error-system.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.join(__dirname, 'test-data');

describe('Error Classes', () => {
  test('KGenError includes structured information', () => {
    const error = new KGenError('Test error', 'TEST_ERROR', { 
      field: 'value',
      severity: 'critical' 
    });
    
    expect(error.name).toBe('KGenError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details.field).toBe('value');
    expect(error.severity).toBe('critical');
    expect(error.recoverable).toBe(true);
    expect(error.timestamp).toBeTruthy();
    
    const json = error.toJSON();
    expect(json).toMatchObject({
      name: 'KGenError',
      message: 'Test error',
      code: 'TEST_ERROR',
      severity: 'critical'
    });
  });
  
  test('InitializationError provides component context', () => {
    const cause = new Error('Database connection failed');
    const error = new InitializationError('database', cause);
    
    expect(error.name).toBe('InitializationError');
    expect(error.message).toContain('Failed to initialize database');
    expect(error.message).toContain('Database connection failed');
    expect(error.code).toBe('INIT_ERROR');
    expect(error.details.component).toBe('database');
    expect(error.details.cause).toBe('Database connection failed');
    expect(error.recoverable).toBe(false);
  });
  
  test('ValidationError provides detailed field information', () => {
    const error = new ValidationError('username', '', 'non-empty string');
    
    expect(error.name).toBe('ValidationError');
    expect(error.message).toContain('Validation failed for username');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.field).toBe('username');
    expect(error.details.value).toBe('');
    expect(error.details.expected).toBe('non-empty string');
  });
});

describe('InputValidator', () => {
  beforeEach(async () => {
    await fs.mkdir(testDataDir, { recursive: true });
  });
  
  afterEach(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  describe('validateFilePath', () => {
    test('validates normal file paths', () => {
      const result = InputValidator.validateFilePath('/tmp/test.txt');
      expect(result).toBe(path.normalize('/tmp/test.txt'));
    });
    
    test('rejects directory traversal attempts', () => {
      expect(() => {
        InputValidator.validateFilePath('../../../etc/passwd');
      }).toThrow(ValidationError);
      
      expect(() => {
        InputValidator.validateFilePath('~/secrets');
      }).toThrow(ValidationError);
    });
    
    test('rejects null bytes', () => {
      expect(() => {
        InputValidator.validateFilePath('test\0file.txt');
      }).toThrow(ValidationError);
    });
    
    test('rejects overly long paths', () => {
      const longPath = 'a'.repeat(1001);
      expect(() => {
        InputValidator.validateFilePath(longPath);
      }).toThrow(ValidationError);
    });
  });
  
  describe('validateFileAccess', () => {
    test('validates existing files', async () => {
      const testFile = path.join(testDataDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      
      const result = await InputValidator.validateFileAccess(testFile, 'read');
      
      expect(result.path).toBe(testFile);
      expect(result.isFile).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });
    
    test('rejects non-existent files', async () => {
      const nonExistentFile = path.join(testDataDir, 'nonexistent.txt');
      
      await expect(() => {
        return InputValidator.validateFileAccess(nonExistentFile, 'read');
      }).rejects.toThrow(FileSystemError);
    });
    
    test('rejects files that are too large', async () => {
      const testFile = path.join(testDataDir, 'large.txt');
      await fs.writeFile(testFile, 'x'.repeat(1000));
      
      await expect(() => {
        return InputValidator.validateFileAccess(testFile, 'read', { maxSize: 100 });
      }).rejects.toThrow(ValidationError);
    });
  });
  
  describe('validateTemplate', () => {
    test('validates normal template names', () => {
      const result = InputValidator.validateTemplate('my-template');
      expect(result).toBe('my-template');
    });
    
    test('validates templates with allowed extensions', () => {
      const result = InputValidator.validateTemplate('my-template.njk');
      expect(result).toBe('my-template.njk');
    });
    
    test('rejects templates with special characters', () => {
      expect(() => {
        InputValidator.validateTemplate('my@template');
      }).toThrow(ValidationError);
      
      expect(() => {
        InputValidator.validateTemplate('my template');
      }).toThrow(ValidationError);
    });
  });
  
  describe('validateContext', () => {
    test('validates normal objects', () => {
      const context = { name: 'test', value: 123 };
      const result = InputValidator.validateContext(context);
      expect(result).toEqual(context);
    });
    
    test('rejects dangerous properties', () => {
      expect(() => {
        InputValidator.validateContext({ __proto__: { evil: true } });
      }).toThrow(ValidationError);
      
      expect(() => {
        InputValidator.validateContext({ constructor: { evil: true } });
      }).toThrow(ValidationError);
    });
    
    test('validates nested objects', () => {
      const context = {
        user: {
          profile: {
            name: 'test'
          }
        }
      };
      
      const result = InputValidator.validateContext(context);
      expect(result).toEqual(context);
    });
    
    test('rejects deeply nested objects', () => {
      const context = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: 'too deep' } } } } } } } } } } };
      
      expect(() => {
        InputValidator.validateContext(context, { maxDepth: 5 });
      }).toThrow(ValidationError);
    });
  });
  
  describe('validateJSON', () => {
    test('parses valid JSON', () => {
      const json = '{"name": "test", "value": 123}';
      const result = InputValidator.validateJSON(json, 'testField');
      expect(result).toEqual({ name: 'test', value: 123 });
    });
    
    test('rejects invalid JSON', () => {
      expect(() => {
        InputValidator.validateJSON('invalid json', 'testField');
      }).toThrow(ValidationError);
    });
  });
});

describe('ResourceManager', () => {
  let resourceManager;
  
  beforeEach(() => {
    resourceManager = new ResourceManager();
  });
  
  afterEach(async () => {
    await resourceManager.dispose();
  });
  
  test('acquires and releases resources', async () => {
    const mockResource = { data: 'test' };
    const cleanupSpy = vi.fn();
    
    const resource = await resourceManager.acquire(
      'test-resource',
      () => Promise.resolve(mockResource),
      cleanupSpy
    );
    
    expect(resource).toBe(mockResource);
    expect(resourceManager.hasResource('test-resource')).toBe(true);
    
    await resourceManager.release('test-resource');
    
    expect(cleanupSpy).toHaveBeenCalledWith(mockResource);
    expect(resourceManager.hasResource('test-resource')).toBe(false);
  });
  
  test('prevents race conditions on acquisition', async () => {
    const factory = vi.fn(() => Promise.resolve({ data: 'test' }));
    
    // Try to acquire the same resource simultaneously
    const promise1 = resourceManager.acquire('test-resource', factory);
    const promise2 = resourceManager.acquire('test-resource', factory);
    
    await expect(promise1).resolves.toBeTruthy();
    await expect(promise2).rejects.toThrow(RaceConditionError);
  });
  
  test('handles acquisition failures', async () => {
    const failingFactory = () => Promise.reject(new Error('Factory failed'));
    
    await expect(() => {
      return resourceManager.acquire('failing-resource', failingFactory);
    }).rejects.toThrow(KGenError);
    
    expect(resourceManager.hasResource('failing-resource')).toBe(false);
  });
  
  test('disposes all resources on dispose', async () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    
    await resourceManager.acquire('resource1', () => ({ data: 1 }), cleanup1);
    await resourceManager.acquire('resource2', () => ({ data: 2 }), cleanup2);
    
    expect(resourceManager.getResourceCount()).toBe(2);
    
    await resourceManager.dispose();
    
    expect(cleanup1).toHaveBeenCalled();
    expect(cleanup2).toHaveBeenCalled();
    expect(resourceManager.getResourceCount()).toBe(0);
  });
});

describe('AsyncErrorHandler', () => {
  test('retries failed operations', async () => {
    let attempts = 0;
    const operation = vi.fn(() => {
      attempts++;
      if (attempts < 3) {
        throw new KGenError('Temporary failure', 'TEMP_ERROR');
      }
      return 'success';
    });
    
    const result = await AsyncErrorHandler.withRetry(operation, {
      maxAttempts: 3,
      backoffMs: 10
    });
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });
  
  test('respects shouldRetry predicate', async () => {
    const operation = vi.fn(() => {
      throw new KGenError('Permanent failure', 'PERM_ERROR', { recoverable: false });
    });
    
    await expect(() => {
      return AsyncErrorHandler.withRetry(operation, {
        maxAttempts: 3,
        shouldRetry: (error) => error.recoverable !== false
      });
    }).rejects.toThrow('Permanent failure');
    
    expect(operation).toHaveBeenCalledTimes(1);
  });
  
  test('handles timeouts', async () => {
    const slowOperation = () => new Promise(resolve => {
      setTimeout(() => resolve('too slow'), 1000);
    });
    
    await expect(() => {
      return AsyncErrorHandler.withTimeout(slowOperation, 100);
    }).rejects.toThrow('Operation timed out');
  });
  
  test('implements circuit breaker', async () => {
    let callCount = 0;
    const failingOperation = () => {
      callCount++;
      throw new Error('Always fails');
    };
    
    // Trip the circuit breaker
    for (let i = 0; i < 5; i++) {
      await expect(() => {
        return AsyncErrorHandler.withCircuitBreaker(failingOperation, {
          name: 'test-circuit',
          failureThreshold: 3
        });
      }).rejects.toThrow();
    }
    
    // Circuit should be open now
    await expect(() => {
      return AsyncErrorHandler.withCircuitBreaker(failingOperation, {
        name: 'test-circuit',
        failureThreshold: 3,
        resetTimeoutMs: 1000
      });
    }).rejects.toThrow('Circuit breaker is open');
    
    expect(callCount).toBeLessThan(10); // Should have stopped calling after circuit opened
  });
});

describe('WebhookHandler', () => {
  let webhookHandler;
  
  beforeEach(() => {
    webhookHandler = new WebhookHandler({
      defaultTimeout: 5000,
      maxRetries: 2
    });
  });
  
  test('sends successful webhooks', async () => {
    // Mock fetch for successful response
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ received: true }),
      text: () => Promise.resolve('{"received": true}')
    }));
    
    const result = await webhookHandler.send('https://example.com/webhook', {
      event: 'test',
      data: { value: 123 }
    });
    
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ received: true });
    
    global.fetch.mockRestore();
  });
  
  test('retries failed webhooks', async () => {
    let callCount = 0;
    
    global.fetch = vi.fn(() => {
      callCount++;
      if (callCount < 2) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Server error')
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ received: true })
      });
    });
    
    const result = await webhookHandler.send('https://example.com/webhook', {
      event: 'test'
    });
    
    expect(result.success).toBe(true);
    expect(callCount).toBe(2);
    
    global.fetch.mockRestore();
  });
  
  test('handles permanent failures gracefully', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad request')
    }));
    
    const result = await webhookHandler.send('https://example.com/webhook', {
      event: 'test'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    
    global.fetch.mockRestore();
  });
  
  test('validates webhook URLs', async () => {
    const result = await webhookHandler.send('invalid-url', { event: 'test' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });
});

describe('AttestationVerifier', () => {
  let verifier;
  
  beforeEach(async () => {
    verifier = new AttestationVerifier();
    await fs.mkdir(testDataDir, { recursive: true });
  });
  
  afterEach(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  test('verifies valid attestations', async () => {
    const testContent = 'test artifact content';
    const testFile = path.join(testDataDir, 'artifact.txt');
    const attestationFile = path.join(testDataDir, 'artifact.txt.attest.json');
    
    await fs.writeFile(testFile, testContent);
    
    // Create a valid attestation
    const contentHash = require('crypto').createHash('sha256').update(testContent).digest('hex');
    const attestation = {
      version: '1.0',
      contentHash: contentHash,
      timestamp: this.getDeterministicDate().toISOString()
    };
    
    await fs.writeFile(attestationFile, JSON.stringify(attestation, null, 2));
    
    const result = await verifier.verify(testFile, attestationFile);
    
    expect(result.success).toBe(true);
    expect(result.verification.contentHash.matches).toBe(true);
    expect(result.verification.contentHash.actual).toBe(contentHash);
  });
  
  test('detects content hash mismatches', async () => {
    const testFile = path.join(testDataDir, 'artifact.txt');
    const attestationFile = path.join(testDataDir, 'artifact.txt.attest.json');
    
    await fs.writeFile(testFile, 'current content');
    
    // Create attestation with wrong hash
    const attestation = {
      version: '1.0',
      contentHash: 'wrong_hash',
      timestamp: this.getDeterministicDate().toISOString()
    };
    
    await fs.writeFile(attestationFile, JSON.stringify(attestation, null, 2));
    
    const result = await verifier.verify(testFile, attestationFile);
    
    expect(result.success).toBe(false);
    expect(result.verification.contentHash.matches).toBe(false);
    expect(result.issues).toContain('Content hash mismatch');
  });
  
  test('handles missing attestation files', async () => {
    const testFile = path.join(testDataDir, 'artifact.txt');
    await fs.writeFile(testFile, 'test content');
    
    await expect(() => {
      return verifier.verify(testFile, path.join(testDataDir, 'nonexistent.attest.json'));
    }).rejects.toThrow(FileSystemError);
  });
  
  test('handles malformed attestations', async () => {
    const testFile = path.join(testDataDir, 'artifact.txt');
    const attestationFile = path.join(testDataDir, 'artifact.txt.attest.json');
    
    await fs.writeFile(testFile, 'test content');
    await fs.writeFile(attestationFile, 'invalid json');
    
    await expect(() => {
      return verifier.verify(testFile, attestationFile);
    }).rejects.toThrow(AttestationError);
  });
});

describe('ContentResolver', () => {
  let resolver;
  
  beforeEach(async () => {
    resolver = new ContentResolver({
      timeout: 5000,
      cacheTimeout: 1000 // 1 second for testing
    });
    await fs.mkdir(testDataDir, { recursive: true });
  });
  
  afterEach(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  test('resolves file URIs', async () => {
    const testFile = path.join(testDataDir, 'test.txt');
    await fs.writeFile(testFile, 'test content');
    
    const result = await resolver.resolve(`file://${testFile}`);
    
    expect(result.success).toBe(true);
    expect(result.type).toBe('file');
    expect(result.content).toBe('test content');
    expect(result.contentType).toBe('text/plain');
  });
  
  test('resolves HTTP URIs', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve('remote content'),
      headers: new Map([['content-type', 'text/plain']])
    }));
    
    const result = await resolver.resolve('https://example.com/content.txt');
    
    expect(result.success).toBe(true);
    expect(result.type).toBe('http');
    expect(result.content).toBe('remote content');
    
    global.fetch.mockRestore();
  });
  
  test('caches resolved content', async () => {
    const testFile = path.join(testDataDir, 'cached.txt');
    await fs.writeFile(testFile, 'cached content');
    
    const uri = `file://${testFile}`;
    
    // First resolution
    const result1 = await resolver.resolve(uri);
    expect(result1.fromCache).toBeUndefined();
    
    // Second resolution should be from cache
    const result2 = await resolver.resolve(uri);
    expect(result2.fromCache).toBe(true);
    expect(result2.content).toBe('cached content');
  });
  
  test('respects cache timeout', async () => {
    const testFile = path.join(testDataDir, 'timeout-test.txt');
    await fs.writeFile(testFile, 'original content');
    
    const uri = `file://${testFile}`;
    
    // First resolution
    await resolver.resolve(uri);
    
    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Update file content
    await fs.writeFile(testFile, 'updated content');
    
    // Second resolution should fetch fresh content
    const result = await resolver.resolve(uri);
    expect(result.content).toBe('updated content');
    expect(result.fromCache).toBeUndefined();
  });
  
  test('detects content types', async () => {
    const jsonFile = path.join(testDataDir, 'test.json');
    const xmlFile = path.join(testDataDir, 'test.xml');
    const turtleFile = path.join(testDataDir, 'test.ttl');
    
    await fs.writeFile(jsonFile, '{"key": "value"}');
    await fs.writeFile(xmlFile, '<root><item>value</item></root>');
    await fs.writeFile(turtleFile, '@prefix ex: <http://example.org/> .\nex:subject ex:predicate "value" .');
    
    const jsonResult = await resolver.resolve(`file://${jsonFile}`);
    const xmlResult = await resolver.resolve(`file://${xmlFile}`);
    const turtleResult = await resolver.resolve(`file://${turtleFile}`);
    
    expect(jsonResult.contentType).toBe('application/json');
    expect(xmlResult.contentType).toBe('text/xml');
    expect(turtleResult.contentType).toBe('text/turtle');
  });
  
  test('handles unsupported URI schemes', async () => {
    await expect(() => {
      return resolver.resolve('ftp://example.com/file.txt');
    }).rejects.toThrow(ValidationError);
  });
  
  test('clears cache', async () => {
    const testFile = path.join(testDataDir, 'clear-test.txt');
    await fs.writeFile(testFile, 'test content');
    
    const uri = `file://${testFile}`;
    
    // Cache content
    await resolver.resolve(uri);
    
    // Clear cache
    resolver.clearCache();
    
    // Next resolution should not be from cache
    const result = await resolver.resolve(uri);
    expect(result.fromCache).toBeUndefined();
  });
});

describe('Integration Tests', () => {
  test('error propagation through system', async () => {
    const resourceManager = new ResourceManager();
    
    try {
      // Simulate a complex operation that fails
      await resourceManager.acquire(
        'complex-resource',
        async () => {
          throw new ValidationError('input', 'invalid', 'valid input');
        }
      );
    } catch (error) {
      expect(error).toBeInstanceOf(KGenError);
      expect(error.message).toContain('Failed to acquire resource');
      expect(error.details.cause).toContain('Validation failed');
    } finally {
      await resourceManager.dispose();
    }
  });
  
  test('resource cleanup on error', async () => {
    const resourceManager = new ResourceManager();
    const cleanupSpy = vi.fn();
    
    try {
      // Acquire resource successfully
      await resourceManager.acquire(
        'cleanup-test',
        () => ({ data: 'test' }),
        cleanupSpy
      );
      
      // Simulate error during operation
      throw new Error('Operation failed');
      
    } catch (error) {
      // Resource should still be cleaned up
      await resourceManager.dispose();
      expect(cleanupSpy).toHaveBeenCalled();
    }
  });
});

// Test data setup and teardown
beforeEach(async () => {
  // Ensure test data directory exists
  try {
    await fs.mkdir(testDataDir, { recursive: true });
  } catch {
    // Directory might already exist
  }
});

afterEach(async () => {
  // Clean up test data
  try {
    await fs.rm(testDataDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors in tests
  }
});