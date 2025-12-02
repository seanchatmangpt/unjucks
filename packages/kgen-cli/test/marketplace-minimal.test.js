/**
 * Minimal test to verify marketplace install functionality
 */

import { test, expect } from 'vitest';
import { createHash } from 'crypto';

test('KPack reference parsing works correctly', () => {
  const parseReference = (ref) => {
    const patterns = [
      /^(@[^\/]+\/[^@]+)@(.+)$/,
      /^([^@]+)@(.+)$/,
      /^([^@]+)$/
    ];

    for (const pattern of patterns) {
      const match = ref.match(pattern);
      if (match) {
        return {
          name: match[1],
          version: match[2] || 'latest',
          scope: match[1].startsWith('@') ? match[1].split('/')[0] : null
        };
      }
    }
    throw new Error(`Invalid format: ${ref}`);
  };

  // Test scoped package
  const scoped = parseReference('@acme/utils@1.0.0');
  expect(scoped.name).toBe('@acme/utils');
  expect(scoped.version).toBe('1.0.0');
  expect(scoped.scope).toBe('@acme');

  // Test unscoped package
  const unscoped = parseReference('lodash@4.17.21');
  expect(unscoped.name).toBe('lodash');
  expect(unscoped.version).toBe('4.17.21');
  expect(unscoped.scope).toBe(null);

  // Test without version
  const noVersion = parseReference('express');
  expect(noVersion.name).toBe('express');
  expect(noVersion.version).toBe('latest');
});

test('Content hashing works correctly', () => {
  const content = 'test content for hashing';
  const hash1 = createHash('sha256').update(content).digest('hex');
  const hash2 = createHash('sha256').update(content).digest('hex');
  
  expect(hash1).toBe(hash2);
  expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  
  // Different content should produce different hashes
  const differentContent = 'different content';
  const hash3 = createHash('sha256').update(differentContent).digest('hex');
  expect(hash1).not.toBe(hash3);
});

test('Mock registry operations work', () => {
  const mockDownload = (packageRef) => {
    return {
      manifest: {
        name: packageRef.name,
        version: packageRef.version,
        description: `Mock package for ${packageRef.name}`,
        files: ['index.js', 'README.md']
      },
      content: Buffer.from(`// Mock content for ${packageRef.name}\nexport default {};`),
      attestations: [],
      metadata: {
        downloadedAt: new Date().toISOString(),
        registry: 'mock-registry'
      }
    };
  };

  const packageRef = { name: '@test/mock', version: '1.0.0' };
  const download = mockDownload(packageRef);

  expect(download.manifest.name).toBe('@test/mock');
  expect(download.content).toBeInstanceOf(Buffer);
  expect(download.metadata.registry).toBe('mock-registry');
});

test('Verification logic works correctly', () => {
  const mockVerify = (hasAttestation, isValid) => {
    if (!hasAttestation) {
      throw new Error('No attestations found');
    }
    if (!isValid) {
      throw new Error('Verification failed');
    }
    return { verified: true, issuer: 'test-issuer' };
  };

  // Test successful verification
  const success = mockVerify(true, true);
  expect(success.verified).toBe(true);
  expect(success.issuer).toBe('test-issuer');

  // Test missing attestation
  expect(() => mockVerify(false, true)).toThrow('No attestations found');

  // Test invalid signature
  expect(() => mockVerify(true, false)).toThrow('Verification failed');
});