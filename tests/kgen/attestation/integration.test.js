/**
 * Attestation System Integration Tests
 * 
 * End-to-end tests for complete attestation workflow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AttestationSystem } from '../../../packages/kgen-core/src/attestation/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AttestationSystem Integration', () => {
  let attestationSystem;
  let testDir;
  let testProject;

  beforeEach(async () => {
    // Create test project structure
    testDir = path.join(__dirname, 'integration-test');
    testProject = {
      root: testDir,
      templates: path.join(testDir, 'templates'),
      src: path.join(testDir, 'src'),
      generated: path.join(testDir, 'generated')
    };

    // Create directories
    await fs.mkdir(testProject.root, { recursive: true });
    await fs.mkdir(testProject.templates, { recursive: true });
    await fs.mkdir(testProject.src, { recursive: true });
    await fs.mkdir(testProject.generated, { recursive: true });

    // Create test templates
    await fs.writeFile(
      path.join(testProject.templates, 'component.njk'),
      `import React from 'react';

export const {{ name }} = () => {
  return (
    <div className="{{ className }}">
      <h1>{{ title }}</h1>
      {{ content }}
    </div>
  );
};`
    );

    await fs.writeFile(
      path.join(testProject.templates, 'api.njk'),
      `const express = require('express');
const router = express.Router();

router.get('/{{ endpoint }}', (req, res) => {
  res.json({ message: '{{ message }}' });
});

module.exports = router;`
    );

    // Initialize attestation system
    attestationSystem = new AttestationSystem({
      enableBlockchainIntegrity: false,
      enableFastVerification: true
    });

    await attestationSystem.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('end-to-end workflow', () => {
    it('should handle complete generation and verification workflow', async () => {
      // 1. Generate artifacts with attestations
      const artifacts = [];
      
      // Generate React component
      const componentPath = path.join(testProject.generated, 'UserProfile.jsx');
      await fs.writeFile(componentPath, `import React from 'react';

export const UserProfile = () => {
  return (
    <div className="user-profile">
      <h1>User Profile</h1>
      <p>Welcome to your profile page</p>
    </div>
  );
};`);

      const componentContext = {
        templatePath: path.join(testProject.templates, 'component.njk'),
        templateHash: 'comp123hash',
        sourceGraph: {
          User: { name: 'string', email: 'string' },
          Profile: { userId: 'string', bio: 'string' }
        },
        variables: {
          name: 'UserProfile',
          className: 'user-profile',
          title: 'User Profile',
          content: '<p>Welcome to your profile page</p>'
        },
        agent: 'kgen-react-generator',
        templateFamily: 'react-components',
        dependencies: ['react']
      };

      const componentAttestation = await attestationSystem.generateAttestation(
        componentPath, 
        componentContext
      );

      artifacts.push({
        path: componentPath,
        attestation: componentAttestation,
        type: 'react-component'
      });

      // Generate API endpoint
      const apiPath = path.join(testProject.generated, 'users-api.js');
      await fs.writeFile(apiPath, `const express = require('express');
const router = express.Router();

router.get('/users', (req, res) => {
  res.json({ message: 'List of users' });
});

module.exports = router;`);

      const apiContext = {
        templatePath: path.join(testProject.templates, 'api.njk'),
        templateHash: 'api456hash',
        sourceGraph: {
          UserAPI: { endpoint: '/users', method: 'GET' }
        },
        variables: {
          endpoint: 'users',
          message: 'List of users'
        },
        agent: 'kgen-api-generator',
        templateFamily: 'express-apis',
        dependencies: ['express']
      };

      const apiAttestation = await attestationSystem.generateAttestation(
        apiPath, 
        apiContext
      );

      artifacts.push({
        path: apiPath,
        attestation: apiAttestation,
        type: 'express-api'
      });

      // 2. Verify all artifacts
      const verificationResults = [];
      for (const artifact of artifacts) {
        const verification = await attestationSystem.verifyAttestation(artifact.path);
        verificationResults.push({
          artifact: artifact.path,
          verified: verification.verified,
          type: artifact.type
        });
      }

      // All should be verified
      expect(verificationResults.every(r => r.verified)).toBe(true);

      // 3. Explain artifacts
      const explanations = [];
      for (const artifact of artifacts) {
        const explanation = await attestationSystem.explainArtifact(artifact.path);
        explanations.push(explanation);
      }

      // All explanations should succeed
      expect(explanations.every(e => e.success)).toBe(true);

      // Check explanation details
      const componentExplanation = explanations.find(e => 
        e.explanation.artifact.path === componentPath
      );
      expect(componentExplanation.explanation.origin.template.path).toBe(
        path.join(testProject.templates, 'component.njk')
      );
      expect(componentExplanation.explanation.origin.variables.name).toBe('UserProfile');

      // 4. Batch verification
      const batchResult = await attestationSystem.batchVerify(
        artifacts.map(a => a.path)
      );

      expect(batchResult.verified).toBe(artifacts.length);
      expect(batchResult.failed).toBe(0);
    });

    it('should detect and report tampering', async () => {
      // Generate artifact with attestation
      const artifactPath = path.join(testProject.generated, 'Component.jsx');
      await fs.writeFile(artifactPath, 'Original content');

      const context = {
        templatePath: path.join(testProject.templates, 'component.njk'),
        variables: { name: 'TestComponent' }
      };

      await attestationSystem.generateAttestation(artifactPath, context);

      // Verify original
      let verification = await attestationSystem.verifyAttestation(artifactPath);
      expect(verification.verified).toBe(true);

      // Tamper with artifact
      await fs.writeFile(artifactPath, 'Tampered content');

      // Verify tampered
      verification = await attestationSystem.verifyAttestation(artifactPath);
      expect(verification.verified).toBe(false);

      // Explanation should fail
      const explanation = await attestationSystem.explainArtifact(artifactPath);
      expect(explanation.success).toBe(false);
      expect(explanation.reason).toBe('Attestation verification failed');
    });

    it('should maintain chain integrity across multiple generations', async () => {
      const artifacts = [];
      
      // Generate multiple artifacts in sequence
      for (let i = 0; i < 5; i++) {
        const artifactPath = path.join(testProject.generated, `artifact-${i}.js`);
        await fs.writeFile(artifactPath, `console.log("Artifact ${i}");`);

        const context = {
          templatePath: path.join(testProject.templates, `template-${i}.njk`),
          variables: { index: i }
        };

        const attestation = await attestationSystem.generateAttestation(artifactPath, context);
        artifacts.push(attestation);
      }

      // Verify chain integrity
      const attestationObjects = artifacts.map(a => a.attestation);
      const chainVerification = await attestationSystem.verifier.verifyChain(attestationObjects);

      expect(chainVerification.verified).toBe(true);
      expect(chainVerification.chainLength).toBe(5);
      expect(chainVerification.validLinks).toBe(4);
      expect(chainVerification.integrityScore).toBe(1);

      // Each attestation should reference the previous one correctly
      for (let i = 1; i < attestationObjects.length; i++) {
        expect(attestationObjects[i].integrity.chainIndex).toBe(
          attestationObjects[i - 1].integrity.chainIndex + 1
        );
        expect(attestationObjects[i].integrity.previousHash).toBe(
          attestationObjects[i - 1].attestationHash
        );
      }
    });
  });

  describe('performance testing', () => {
    it('should handle large numbers of artifacts efficiently', async () => {
      const numberOfArtifacts = 50;
      const artifacts = [];

      // Generate many artifacts
      const startGeneration = this.getDeterministicTimestamp();
      for (let i = 0; i < numberOfArtifacts; i++) {
        const artifactPath = path.join(testProject.generated, `perf-${i}.js`);
        await fs.writeFile(artifactPath, `console.log("Performance test ${i}");`);

        const context = {
          templatePath: '/templates/perf-template.njk',
          variables: { index: i }
        };

        const attestation = await attestationSystem.generateAttestation(artifactPath, context);
        artifacts.push(artifactPath);
      }
      const generationTime = this.getDeterministicTimestamp() - startGeneration;

      // Batch verify all artifacts
      const startVerification = this.getDeterministicTimestamp();
      const batchResult = await attestationSystem.batchVerify(artifacts);
      const verificationTime = this.getDeterministicTimestamp() - startVerification;

      expect(batchResult.verified).toBe(numberOfArtifacts);
      expect(batchResult.failed).toBe(0);

      // Performance expectations (adjust based on system)
      expect(generationTime).toBeLessThan(numberOfArtifacts * 100); // <100ms per artifact
      expect(verificationTime).toBeLessThan(numberOfArtifacts * 50);  // <50ms per verification

      console.log(`Generated ${numberOfArtifacts} attestations in ${generationTime}ms`);
      console.log(`Verified ${numberOfArtifacts} attestations in ${verificationTime}ms`);
    });

    it('should efficiently cache verification results', async () => {
      const artifactPath = path.join(testProject.generated, 'cached-test.js');
      await fs.writeFile(artifactPath, 'console.log("Cache test");');

      await attestationSystem.generateAttestation(artifactPath, {
        templatePath: '/templates/cache-test.njk'
      });

      // First verification (not cached)
      const startFirst = this.getDeterministicTimestamp();
      const firstResult = await attestationSystem.verifyAttestation(artifactPath);
      const firstTime = this.getDeterministicTimestamp() - startFirst;

      // Second verification (cached)
      const startSecond = this.getDeterministicTimestamp();
      const secondResult = await attestationSystem.verifyAttestation(artifactPath);
      const secondTime = this.getDeterministicTimestamp() - startSecond;

      expect(firstResult.verified).toBe(true);
      expect(secondResult.verified).toBe(true);
      expect(secondResult.cached).toBe(true);
      expect(secondTime).toBeLessThan(firstTime);
    });
  });

  describe('error scenarios', () => {
    it('should handle missing template files gracefully', async () => {
      const artifactPath = path.join(testProject.generated, 'test.js');
      await fs.writeFile(artifactPath, 'console.log("test");');

      const context = {
        templatePath: '/non-existent/template.njk',
        variables: { name: 'test' }
      };

      // Should still generate attestation
      const result = await attestationSystem.generateAttestation(artifactPath, context);
      expect(result.attestation).toBeDefined();

      // Template version should indicate unknown
      expect(result.attestation.provenance.templateVersion).toContain('unknown');
    });

    it('should handle corrupted sidecar files', async () => {
      const artifactPath = path.join(testProject.generated, 'corrupted.js');
      await fs.writeFile(artifactPath, 'console.log("test");');

      // Create corrupted sidecar
      await fs.writeFile(artifactPath + '.attest.json', 'invalid json content');

      const verification = await attestationSystem.verifyAttestation(artifactPath);
      expect(verification.verified).toBe(false);

      const explanation = await attestationSystem.explainArtifact(artifactPath);
      expect(explanation.success).toBe(false);
    });

    it('should handle concurrent access safely', async () => {
      const artifactPath = path.join(testProject.generated, 'concurrent.js');
      await fs.writeFile(artifactPath, 'console.log("concurrent test");');

      await attestationSystem.generateAttestation(artifactPath, {
        templatePath: '/templates/concurrent.njk'
      });

      // Multiple concurrent verifications should work
      const promises = Array.from({ length: 10 }, () =>
        attestationSystem.verifyAttestation(artifactPath)
      );

      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results.every(r => r.verified)).toBe(true);
      
      // At least one should be cached (after the first)
      expect(results.some(r => r.cached)).toBe(true);
    });
  });

  describe('system statistics', () => {
    it('should provide comprehensive system statistics', async () => {
      // Generate a few artifacts
      for (let i = 0; i < 3; i++) {
        const artifactPath = path.join(testProject.generated, `stats-${i}.js`);
        await fs.writeFile(artifactPath, `console.log("Stats ${i}");`);

        await attestationSystem.generateAttestation(artifactPath, {
          templatePath: `/templates/stats-${i}.njk`
        });
      }

      const stats = attestationSystem.getStatistics();

      expect(stats.initialized).toBe(true);
      expect(stats.generator.totalArtifacts).toBe(3);
      expect(stats.generator.hashChainLength).toBe(4); // Genesis + 3 artifacts
      expect(stats.generator.templateVersions).toBe(3);
      expect(stats.verifier.cacheSize).toBeGreaterThanOrEqual(0);
    });
  });
});