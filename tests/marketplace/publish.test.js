/**
 * Marketplace Publish Command Tests
 * 
 * Test deterministic packaging, SLSA attestation, and registry publishing.
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import the publish command
import publishCommand from '../../packages/kgen-cli/src/commands/marketplace/publish.js';

describe('Marketplace Publish Command', () => {
  let tempDir;
  let packageDir;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await mkdtemp(join(tmpdir(), 'kgen-marketplace-test-'));
    packageDir = join(tempDir, 'test-package');
    await mkdir(packageDir, { recursive: true });

    // Create test kpack.json manifest
    const manifest = {
      name: '@test/sample-package',
      version: '1.0.0',
      description: 'Test package for marketplace publishing',
      main: 'index.njk',
      author: 'Test Author',
      license: 'MIT'
    };

    await writeFile(
      join(packageDir, 'kpack.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create test files
    await writeFile(join(packageDir, 'index.njk'), 'Hello {{ name }}!');
    await writeFile(join(packageDir, 'README.md'), '# Test Package\n');
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should validate kpack.json manifest', async () => {
    const args = {
      path: packageDir,
      dry: true,
      registry: 'npm',
      visibility: 'public'
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.package.name).toBe('@test/sample-package');
  });

  it('should create deterministic bundle with fixed timestamps', async () => {
    const args = {
      path: packageDir,
      dry: true,
      sourceDate: '2024-01-01T00:00:00.000Z'
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.bundle.deterministic).toBe(true);
  });

  it('should generate SLSA attestation', async () => {
    const args = {
      path: packageDir,
      dry: true,
      slsa: true
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.attestation.slsa).toBe(true);
  });

  it('should generate SPDX SBOM', async () => {
    const args = {
      path: packageDir,
      dry: true,
      sbom: true
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.attestation.sbom).toBe(true);
  });

  it('should create content-addressed bundle hash', async () => {
    const args = {
      path: packageDir,
      dry: false,
      output: join(tempDir, 'output')
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.bundle.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should fail with missing manifest', async () => {
    await rm(join(packageDir, 'kpack.json'));

    const args = {
      path: packageDir,
      dry: true
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('MARKETPLACE_PUBLISH_FAILED');
  });

  it('should validate compliance dimensions', async () => {
    const args = {
      path: packageDir,
      dry: true,
      dim: 'domain=Legal',
      visibility: 'enterprise'
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.compliance.dim).toBe('domain=Legal');
    expect(result.data.compliance.visibility).toBe('enterprise');
  });

  it('should prepare NPM registry publication', async () => {
    const args = {
      path: packageDir,
      dry: true,
      registry: 'npm',
      visibility: 'public'
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.registry).toBeNull(); // dry run
  });

  it('should prepare OCI registry publication', async () => {
    const args = {
      path: packageDir,
      dry: true,
      registry: 'oci',
      visibility: 'public'
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.registry).toBeNull(); // dry run
  });

  it('should prepare Git registry publication', async () => {
    const args = {
      path: packageDir,
      dry: true,
      registry: 'git',
      visibility: 'public'  
    };

    const result = await publishCommand.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.registry).toBeNull(); // dry run
  });
});

describe('Marketplace Validation', () => {
  let tempDir;
  let packageDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'kgen-validation-test-'));
    packageDir = join(tempDir, 'test-package');
    await mkdir(packageDir, { recursive: true });
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should validate complete enterprise package', async () => {
    // Create comprehensive enterprise kpack.json
    const manifest = {
      name: '@enterprise/test-compliance',
      version: '2.1.0',
      description: 'Enterprise compliance package with full validation',
      main: 'templates/index.njk',
      author: 'Enterprise Team <enterprise@example.com>',
      license: 'Commercial',
      repository: {
        type: 'git',
        url: 'https://github.com/enterprise/test-compliance.git'
      },
      keywords: ['compliance', 'enterprise', 'gdpr'],
      category: 'compliance',
      visibility: 'enterprise',
      compliance: {
        frameworks: ['GDPR', 'HIPAA'],
        dataProcessing: {
          purposes: ['consent-management'],
          legalBasis: ['consent'],
          retentionPolicies: true
        },
        auditTrail: {
          enabled: true,
          immutable: true
        }
      }
    };

    await writeFile(
      join(packageDir, 'kpack.json'),
      JSON.stringify(manifest, null, 2)
    );

    await writeFile(join(packageDir, 'README.md'), '# Enterprise Package\n');
    await writeFile(join(packageDir, 'LICENSE'), 'Commercial License\n');

    // Import validation command
    const validateCommand = await import('../../packages/kgen-cli/src/commands/marketplace/validate.js');
    
    const args = {
      path: packageDir,
      strict: true,
      compliance: 'gdpr'
    };

    const result = await validateCommand.default.run({ args });
    expect(result.success).toBe(true);
    expect(result.data.overall.readyForSubmission).toBe(true);
  });

  it('should detect missing required fields', async () => {
    // Create incomplete manifest
    const manifest = {
      name: '@test/incomplete',
      description: 'Missing required fields'
      // Missing version, main, author
    };

    await writeFile(
      join(packageDir, 'kpack.json'),
      JSON.stringify(manifest, null, 2)
    );

    const validateCommand = await import('../../packages/kgen-cli/src/commands/marketplace/validate.js');
    
    const args = {
      path: packageDir,
      strict: true
    };

    const result = await validateCommand.default.run({ args });
    expect(result.success).toBe(false);
  });
});