/**
 * Artifact Explain Command
 * 
 * Explain provenance and generation details of artifacts.
 * Essential for audit trails and compliance verification.
 */

import { defineCommand } from 'citty';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig, hashFile } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'explain',
    description: 'Explain provenance and generation details of an artifact'
  },
  args: {
    file: {
      type: 'string',
      description: 'Path to artifact file to explain',
      required: true,
      alias: 'f'
    },
    verbose: {
      type: 'boolean',
      description: 'Include detailed provenance information',
      alias: 'v'
    },
    verify: {
      type: 'boolean',
      description: 'Verify artifact integrity against attestation',
      default: true
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'fmt'
    }
  },
  async run({ args }) {
    try {
      const startTime = Date.now();
      
      // Load configuration
      const config = await loadKgenConfig(args.config);
      
      // Validate artifact file
      const artifactPath = resolve(args.file);
      if (!existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
      }
      
      const stats = statSync(artifactPath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${artifactPath}`);
      }
      
      // Calculate current hash
      const currentHash = hashFile(artifactPath);
      const attestPath = artifactPath + '.attest.json';
      
      let attestation = null;
      let verificationStatus = 'no_attestation';
      
      // Load attestation if it exists
      if (existsSync(attestPath)) {
        try {
          const attestContent = readFileSync(attestPath, 'utf8');
          attestation = JSON.parse(attestContent);
          
          // Verify integrity
          if (args.verify && attestation.artifact?.hash) {
            verificationStatus = currentHash === attestation.artifact.hash
              ? 'verified'
              : 'hash_mismatch';
          } else {
            verificationStatus = 'not_verified';
          }
        } catch (e) {
          verificationStatus = 'invalid_attestation';
          attestation = { error: e.message };
        }
      }
      
      // Build explanation
      const explanation = {
        artifact: {
          path: artifactPath,
          size: stats.size,
          currentHash,
          lastModified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString()
        },
        verification: {
          status: verificationStatus,
          verified: verificationStatus === 'verified',
          attestationFound: attestation !== null
        }
      };
      
      // Add provenance information if available
      if (attestation && !attestation.error) {
        explanation.provenance = {
          source: attestation.source || {},
          generation: {
            method: attestation.provenance?.method || 'unknown',
            reproducible: attestation.provenance?.reproducible || false,
            generatedAt: attestation.artifact?.generatedAt || null,
            expectedHash: attestation.artifact?.hash || null
          },
          engine: {
            id: attestation.source?.engineId || 'unknown',
            version: attestation.source?.engineVersion || 'unknown'
          }
        };
        
        // Add detailed information in verbose mode
        if (args.verbose) {
          explanation.provenance.full = attestation;
        }
      }
      
      // Add verification details
      if (verificationStatus === 'hash_mismatch') {
        explanation.verification.details = {
          currentHash,
          expectedHash: attestation?.artifact?.hash,
          message: 'Artifact has been modified since generation'
        };
      }
      
      // Calculate lineage (in real implementation, would trace back through graph)
      explanation.lineage = {
        dependencies: [],
        templates: attestation?.source?.template ? [attestation.source.template] : [],
        rules: attestation?.source?.rules || []
      };
      
      const duration = Date.now() - startTime;
      
      const result = success(explanation, {
        operation: 'explain',
        durationMs: duration,
        verificationPerformed: args.verify
      });
      
      output(result, args.format);
      
      // Exit with warning if verification failed
      if (args.verify && verificationStatus === 'hash_mismatch') {
        process.exit(2);
      }
      
    } catch (err) {
      const result = error(err.message, 'EXPLAIN_FAILED', {
        file: args.file,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});