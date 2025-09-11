/**
 * Artifact Drift Command
 * 
 * Detect drift between expected and actual artifacts.
 * Critical for maintaining deterministic builds in CI/CD pipelines.
 */

import { defineCommand } from 'citty';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, join } from 'path';

import { success, error, output, validation } from '../../lib/output.js';
import { loadKgenConfig, findFiles, hashFile } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'drift',
    description: 'Check for drift between expected and actual artifacts'
  },
  args: {
    check: {
      type: 'string',
      description: 'Directory to check for drift',
      required: true,
      alias: 'c'
    },
    lockfile: {
      type: 'string',
      description: 'Path to lockfile with expected hashes',
      alias: 'l'
    },
    pattern: {
      type: 'string',
      description: 'Glob pattern for files to check',
      default: '**/*',
      alias: 'p'
    },
    exclude: {
      type: 'string',
      description: 'Glob pattern for files to exclude',
      alias: 'e'
    },
    fix: {
      type: 'boolean',
      description: 'Automatically fix drift by regenerating artifacts',
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
      
      // Load configuration
      const config = await loadKgenConfig(args.config);
      
      // Validate check directory
      const checkDir = resolve(args.check);
      if (!existsSync(checkDir)) {
        throw new Error(`Check directory not found: ${checkDir}`);
      }
      
      const stats = statSync(checkDir);
      if (!stats.isDirectory()) {
        throw new Error(`Check path is not a directory: ${checkDir}`);
      }
      
      // Find files to check
      const patterns = [args.pattern];
      const ignorePatterns = [
        'node_modules/**',
        '.git/**',
        '.kgen/**',
        '**/*.attest.json'
      ];
      
      if (args.exclude) {
        ignorePatterns.push(args.exclude);
      }
      
      const files = findFiles(patterns, {
        cwd: checkDir,
        ignore: ignorePatterns
      });
      
      // Load expected hashes from lockfile if provided
      let expectedHashes = {};
      if (args.lockfile) {
        if (!existsSync(args.lockfile)) {
          throw new Error(`Lockfile not found: ${args.lockfile}`);
        }
        
        const lockContent = readFileSync(args.lockfile, 'utf8');
        const lockData = JSON.parse(lockContent);
        expectedHashes = lockData.artifacts || {};
      }
      
      // Check each file for drift
      const violations = [];
      const checkedFiles = [];
      
      for (const filePath of files) {
        const relativePath = filePath.replace(checkDir + '/', '');
        const currentHash = hashFile(filePath);
        const attestPath = filePath + '.attest.json';
        
        let expectedHash = expectedHashes[relativePath];
        let driftType = 'unknown';
        
        // Check attestation file for expected hash
        if (!expectedHash && existsSync(attestPath)) {
          try {
            const attestData = JSON.parse(readFileSync(attestPath, 'utf8'));
            expectedHash = attestData.artifact?.hash;
            driftType = 'attestation';
          } catch (e) {
            // Invalid attestation file
            violations.push({
              file: relativePath,
              type: 'invalid_attestation',
              message: 'Attestation file is corrupted or invalid',
              details: { attestPath, error: e.message }
            });
          }
        } else if (expectedHash) {
          driftType = 'lockfile';
        }
        
        // Check for drift
        const hasDrift = expectedHash && currentHash !== expectedHash;
        
        checkedFiles.push({
          path: relativePath,
          currentHash,
          expectedHash,
          hasDrift,
          driftType,
          size: statSync(filePath).size
        });
        
        if (hasDrift) {
          violations.push({
            file: relativePath,
            type: 'hash_mismatch',
            message: 'File content differs from expected hash',
            details: {
              currentHash,
              expectedHash,
              source: driftType
            }
          });
        }
        
        // Check for missing attestation
        if (!existsSync(attestPath) && config.generate.attestByDefault) {
          violations.push({
            file: relativePath,
            type: 'missing_attestation',
            message: 'Expected attestation file not found',
            details: { expectedPath: attestPath }
          });
        }
      }
      
      // Check for orphaned files (files without source in graph)
      // This would require graph analysis in real implementation
      
      const duration = Date.now() - startTime;
      const hasDrift = violations.length > 0;
      
      const result = validation(
        !hasDrift,
        violations,
        {
          filesChecked: checkedFiles.length,
          driftDetected: hasDrift,
          violationTypes: [...new Set(violations.map(v => v.type))],
          metrics: {
            durationMs: duration,
            totalFiles: files.length,
            bytesChecked: checkedFiles.reduce((sum, f) => sum + f.size, 0)
          }
        }
      );
      
      // Add file details to result
      result.data.files = checkedFiles;
      
      output(result, args.format);
      
      // Exit with error code if drift detected (for CI/CD)
      if (hasDrift && !args.fix) {
        const exitCode = config.drift.exitCode || 3;
        process.exit(exitCode);
      }
      
    } catch (err) {
      const result = error(err.message, 'DRIFT_CHECK_FAILED', {
        checkDir: args.check,
        lockfile: args.lockfile,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});