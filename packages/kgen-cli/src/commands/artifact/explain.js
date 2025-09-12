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
      
      // Add comprehensive provenance information if available
      if (attestation && !attestation.error) {
        explanation.provenance = {
          // Core generation metadata
          generation: {
            operationId: attestation.generation?.operationId,
            method: attestation.provenance?.derivation?.method || 'generation',
            reproducible: attestation.generation?.reproducible !== false,
            generatedAt: attestation.timestamps?.operationCompleted || null,
            expectedHash: attestation.artifact?.hash || null,
            engine: attestation.generation?.engine || { name: 'unknown', version: 'unknown' }
          },
          
          // PROV-O compliant relationships
          activity: attestation.provenance?.activity || null,
          agent: attestation.provenance?.agent || null,
          
          // Template and rule tracking
          templates: attestation.provenance?.dependencies?.templates || [],
          rules: attestation.provenance?.dependencies?.rules || [],
          
          // Semantic reasoning chain
          reasoning: attestation.provenance?.reasoning ? {
            totalSteps: attestation.provenance.reasoning['kgen:totalSteps'] || 0,
            reasoningTime: attestation.provenance.reasoning['kgen:reasoningTime'] || 0,
            steps: attestation.provenance.reasoning['kgen:steps']?.slice(0, 5) || [] // Limit to first 5 steps
          } : null,
          
          // Quality metrics
          quality: {
            validationLevel: attestation.provenance?.quality?.['kgen:validationLevel'] || 'basic',
            qualityScore: attestation.provenance?.quality?.['kgen:qualityScore'] || 1.0,
            testsCoverage: attestation.provenance?.quality?.['kgen:testsCoverage'] || 0
          },
          
          // Cryptographic integrity
          integrity: {
            algorithm: attestation.integrity?.algorithm || 'sha256',
            chainIndex: attestation.integrity?.chainIndex || 0,
            merkleRoot: attestation.integrity?.merkleRoot || null,
            signed: !!attestation.signature
          }
        };
        
        // Add detailed information in verbose mode
        if (args.verbose) {
          explanation.provenance.full = attestation;
          
          // Add reasoning chain details
          if (attestation.provenance?.reasoning?.['kgen:steps']) {
            explanation.reasoningChain = attestation.provenance.reasoning['kgen:steps'].map((step, index) => ({
              stepNumber: step['kgen:stepNumber'] || index,
              rule: step['kgen:ruleApplied'],
              inferenceType: step['kgen:inferenceType'],
              inputs: step['kgen:inputEntities'] || [],
              outputs: step['kgen:outputEntities'] || [],
              confidence: step['kgen:confidence'] || 1.0
            }));
          }
          
          // Add dependency graph
          if (attestation.provenance?.dependencies) {
            explanation.dependencies = {
              templates: attestation.provenance.dependencies.templates,
              rules: attestation.provenance.dependencies.rules,
              data: attestation.provenance.dependencies.data || [],
              external: attestation.provenance.dependencies.external || []
            };
          }
          
          // Add derivation relationships
          if (attestation.provenance?.derivations) {
            explanation.derivations = attestation.provenance.derivations;
          }
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