/**
 * Project Verify Command (Simple)
 * 
 * Verify lock file integrity against current project state.
 * Essential for detecting drift in reproducible builds.
 */

import { defineCommand } from 'citty';
import { existsSync } from 'fs';
import { resolve } from 'path';

import { success, error, output } from '../../lib/output.js';
import { readLockFile, verifyLockFile } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'verify',
    description: 'Verify lock file integrity against current project state'
  },
  args: {
    lockfile: {
      type: 'string',
      description: 'Path to lock file to verify',
      default: './kgen.lock.json',
      alias: 'l'
    },
    strict: {
      type: 'boolean',
      description: 'Fail on any warnings (treat warnings as errors)',
      default: false
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'f'
    }
  },
  async run({ args }) {
    try {
      const startTime = Date.now();
      
      // Check if lock file exists
      const lockPath = resolve(args.lockfile);
      if (!existsSync(lockPath)) {
        throw new Error(`Lock file not found: ${lockPath}`);
      }
      
      // Read and validate lock file
      const lockData = readLockFile(lockPath);
      
      console.log(`🔍 Verifying lock file: ${lockPath}`);
      console.log(`📊 Lock file version: ${lockData.version}`);
      console.log(`🕐 Created: ${lockData.createdAt}`);
      
      // Perform verification
      const verification = verifyLockFile(lockData, { strict: args.strict });
      
      const duration = Date.now() - startTime;
      
      const result = {
        lockfile: {
          path: lockPath,
          version: lockData.version,
          validation: lockData._validation
        },
        verification: {
          valid: verification.valid,
          errors: verification.errors,
          warnings: verification.warnings,
          checks: verification.checks,
          summary: {
            total: Object.keys(verification.checks).length,
            passed: Object.values(verification.checks).filter(Boolean).length,
            failed: Object.values(verification.checks).filter(c => !c).length
          }
        },
        components: {
          graph: lockData.source?.graph ? {
            path: lockData.source.graph.path,
            hash: lockData.source.graph.hash,
            verified: verification.checks.graph
          } : null,
          templates: {
            count: Object.keys(lockData.templates || {}).length,
            verified: verification.checks.templates
          },
          rules: {
            count: Object.keys(lockData.rules || {}).length,
            verified: verification.checks.rules
          },
          integrity: {
            combined: lockData.integrity?.combined,
            verified: verification.checks.integrity
          }
        },
        metrics: {
          durationMs: duration,
          strict: args.strict
        }
      };
      
      const metadata = {
        timestamp: new Date().toISOString(),
        reproducible: verification.valid && verification.warnings.length === 0,
        driftDetected: !verification.valid || verification.warnings.length > 0
      };
      
      // Check if verification failed or has warnings in strict mode
      if (!verification.valid || (args.strict && verification.warnings.length > 0)) {
        const errorResult = error(
          verification.valid ? 'Verification failed (strict mode)' : 'Lock file verification failed',
          'VERIFY_FAILED',
          result
        );
        output(errorResult, args.format);
        process.exit(1);
      } else {
        // Success or warnings (non-strict)
        if (verification.warnings.length > 0) {
          metadata.warning = {
            message: 'Lock file verification passed with warnings',
            code: 'VERIFY_WARNINGS'
          };
        }
        
        const successResult = success(result, metadata);
        output(successResult, args.format);
      }
      
      console.log(`✅ Verification completed in ${duration}ms`);
      if (verification.errors.length > 0) {
        console.log(`❌ ${verification.errors.length} error(s) found`);
      }
      if (verification.warnings.length > 0) {
        console.log(`⚠️  ${verification.warnings.length} warning(s) found`);
      }
      
    } catch (err) {
      const result = error(err.message, 'VERIFY_ERROR', {
        lockfile: args.lockfile,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});