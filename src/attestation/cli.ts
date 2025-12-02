/**
 * CLI Integration for Enhanced Attestation System
 * 
 * Provides command-line interface for attestation generation, verification,
 * and management within the kgen ecosystem.
 */

import { defineCommand } from 'citty';
import consola from 'consola';
import { AttestationSystem, AttestationCLI } from './index.js';
import { promises as fs } from 'fs';
import path from 'path';

const logger = consola.withTag('kgen:attestation');

/**
 * Main attestation command with subcommands
 */
export const attestationCommand = defineCommand({
  meta: {
    name: 'attest',
    description: 'SLSA-compliant attestation generation and verification'
  },
  subCommands: {
    generate: generateCommand,
    verify: verifyCommand,
    receipts: receiptsCommand,
    keys: keysCommand,
    policy: policyCommand,
    status: statusCommand,
    cleanup: cleanupCommand
  }
});

/**
 * Generate attestation command
 */
export const generateCommand = defineCommand({
  meta: {
    name: 'generate',
    description: 'Generate SLSA-compliant attestation for an artifact'
  },
  args: {
    artifact: {
      type: 'positional',
      description: 'Path to the artifact to attest',
      required: true
    },
    template: {
      type: 'string',
      description: 'Path to the template used to generate the artifact',
      alias: 't'
    },
    variables: {
      type: 'string',
      description: 'JSON string of variables used in generation',
      alias: 'v'
    },
    command: {
      type: 'string',
      description: 'Command used to generate the artifact',
      default: 'kgen'
    },
    args: {
      type: 'string',
      description: 'JSON array of command arguments',
      alias: 'a'
    },
    output: {
      type: 'string',
      description: 'Output path for attestation metadata',
      alias: 'o'
    },
    sign: {
      type: 'boolean',
      description: 'Enable cryptographic signing (default: true)',
      default: true
    },
    'git-notes': {
      type: 'boolean',
      description: 'Store receipt in git-notes (default: true)',
      default: true
    },
    'auto-verify': {
      type: 'boolean',
      description: 'Automatically verify generated attestation (default: true)',
      default: true
    }
  },
  async run({ args }) {
    try {
      logger.info('Generating SLSA-compliant attestation...');
      
      const system = new AttestationSystem({
        generator: {
          enableCryptographicSigning: args.sign,
          enableGitNotes: args['git-notes'],
          timestampSource: 'deterministic'
        },
        enableAutoVerification: args['auto-verify']
      });
      
      const cli = new AttestationCLI(system);
      
      await cli.generate({
        artifact: args.artifact,
        template: args.template,
        variables: args.variables ? JSON.parse(args.variables) : undefined,
        command: args.command,
        args: args.args ? JSON.parse(args.args) : undefined,
        output: args.output
      });
      
    } catch (error) {
      logger.error('Failed to generate attestation:', error);
      process.exit(1);
    }
  }
});

/**
 * Verify attestation command
 */
export const verifyCommand = defineCommand({
  meta: {
    name: 'verify',
    description: 'Verify SLSA-compliant attestation'
  },
  args: {
    attestation: {
      type: 'positional',
      description: 'Path to the attestation file (.attest.json)',
      required: true
    },
    artifact: {
      type: 'string',
      description: 'Path to the artifact for deep verification',
      alias: 'a'
    },
    deep: {
      type: 'boolean',
      description: 'Perform deep verification (verify artifact hash)',
      default: false
    },
    'trust-policy': {
      type: 'string',
      description: 'Path to trust policy file',
      alias: 'p'
    },
    output: {
      type: 'string',
      description: 'Output path for verification results',
      alias: 'o'
    },
    'skip-cache': {
      type: 'boolean',
      description: 'Skip verification cache',
      default: false
    },
    batch: {
      type: 'boolean',
      description: 'Treat attestation argument as directory for batch verification',
      default: false
    },
    concurrency: {
      type: 'number',
      description: 'Maximum concurrent verifications for batch mode',
      default: 5
    }
  },
  async run({ args }) {
    try {
      const system = new AttestationSystem({
        verifier: {
          trustPolicyPath: args['trust-policy'],
          enableTrustPolicyEnforcement: !!args['trust-policy']
        }
      });
      
      const cli = new AttestationCLI(system);
      
      if (args.batch) {
        logger.info('Performing batch verification...');
        
        // Find all .attest.json files in directory
        const attestationDir = args.attestation;
        const files = await fs.readdir(attestationDir);
        const attestationFiles = files
          .filter(f => f.endsWith('.attest.json'))
          .map(f => path.join(attestationDir, f));
        
        if (attestationFiles.length === 0) {
          logger.warn(`No attestation files found in ${attestationDir}`);
          return;
        }
        
        const batchResult = await system.batchVerify(attestationFiles, {
          maxConcurrency: args.concurrency,
          deep: args.deep
        });
        
        logger.info(`Batch verification complete: ${batchResult.summary.verified}/${batchResult.summary.total} passed`);
        
        if (args.output) {
          await fs.writeFile(args.output, JSON.stringify(batchResult, null, 2));
        }
        
        // Exit with error if any verifications failed
        if (batchResult.summary.failed > 0) {
          process.exit(1);
        }
        
      } else {
        await cli.verify({
          attestation: args.attestation,
          artifact: args.artifact,
          deep: args.deep,
          output: args.output
        });
      }
      
    } catch (error) {
      logger.error('Failed to verify attestation:', error);
      process.exit(1);
    }
  }
});

/**
 * Receipts management command
 */
export const receiptsCommand = defineCommand({
  meta: {
    name: 'receipts',
    description: 'Manage attestation receipts stored in git-notes'
  },
  args: {
    artifact: {
      type: 'string',
      description: 'Show receipts for specific artifact',
      alias: 'a'
    },
    commit: {
      type: 'string',
      description: 'Show receipts for specific git commit',
      alias: 'c'
    },
    format: {
      type: 'string',
      description: 'Output format (json|table)',
      default: 'table'
    },
    output: {
      type: 'string',
      description: 'Output file path',
      alias: 'o'
    },
    list: {
      type: 'boolean',
      description: 'List all commits with receipts',
      default: false
    },
    verify: {
      type: 'boolean',
      description: 'Verify receipt integrity',
      default: false
    }
  },
  async run({ args }) {
    try {
      const system = new AttestationSystem();
      const cli = new AttestationCLI(system);
      
      if (args.list) {
        await system.initialize();
        const commits = await system.gitNotes.listReceiptCommits();
        
        logger.info(`Found ${commits.length} commits with attestation receipts:`);
        commits.forEach(commit => {
          console.log(`  ${commit}`);
        });
        
        return;
      }
      
      if (args.verify) {
        await system.initialize();
        
        let receipts: any[] = [];
        if (args.artifact) {
          receipts = await system.getReceiptsForArtifact(args.artifact);
        } else if (args.commit) {
          receipts = await system.getReceipts(args.commit);
        } else {
          logger.error('Must specify --artifact or --commit with --verify');
          process.exit(1);
        }
        
        logger.info(`Verifying ${receipts.length} receipts...`);
        let verified = 0;
        let failed = 0;
        
        for (const receipt of receipts) {
          const result = await system.verifyReceipt(receipt);
          if (result.verified) {
            verified++;
            logger.success(`✓ Receipt ${receipt.id.substring(0, 8)}`);
          } else {
            failed++;
            logger.error(`✗ Receipt ${receipt.id.substring(0, 8)}: ${result.reason}`);
          }
        }
        
        logger.info(`Receipt verification: ${verified} verified, ${failed} failed`);
        return;
      }
      
      await cli.receipts({
        artifact: args.artifact,
        commit: args.commit,
        format: args.format as 'json' | 'table',
        output: args.output
      });
      
    } catch (error) {
      logger.error('Failed to manage receipts:', error);
      process.exit(1);
    }
  }
});

/**
 * Key management command
 */
export const keysCommand = defineCommand({
  meta: {
    name: 'keys',
    description: 'Manage cryptographic keys for attestation signing'
  },
  args: {
    generate: {
      type: 'boolean',
      description: 'Generate new Ed25519 key pair',
      default: false
    },
    show: {
      type: 'boolean',
      description: 'Show current public key',
      default: false
    },
    export: {
      type: 'string',
      description: 'Export public key to file'
    },
    'key-dir': {
      type: 'string',
      description: 'Key directory path',
      default: '.kgen/keys'
    }
  },
  async run({ args }) {
    try {
      const system = new AttestationSystem({
        generator: {
          signingKeyPath: path.join(args['key-dir'], 'signing.key'),
          verifyingKeyPath: path.join(args['key-dir'], 'verifying.key')
        }
      });
      
      const cli = new AttestationCLI(system);
      
      if (args.generate) {
        logger.info('Generating new Ed25519 key pair...');
        await cli.initKeys();
        return;
      }
      
      if (args.show || args.export) {
        const verifyingKeyPath = path.join(args['key-dir'], 'verifying.key');
        
        try {
          const publicKey = await fs.readFile(verifyingKeyPath, 'utf8');
          
          if (args.show) {
            logger.info('Current public key:');
            console.log(publicKey);
          }
          
          if (args.export) {
            await fs.writeFile(args.export, publicKey);
            logger.success(`Public key exported to: ${args.export}`);
          }
          
        } catch (error) {
          logger.error('Public key not found. Generate keys first with --generate');
          process.exit(1);
        }
        
        return;
      }
      
      // Default: show key status
      const signingKeyPath = path.join(args['key-dir'], 'signing.key');
      const verifyingKeyPath = path.join(args['key-dir'], 'verifying.key');
      
      const signingKeyExists = await fs.access(signingKeyPath).then(() => true).catch(() => false);
      const verifyingKeyExists = await fs.access(verifyingKeyPath).then(() => true).catch(() => false);
      
      logger.info('Key status:');
      console.log(`  Signing key:   ${signingKeyExists ? '✓ Present' : '✗ Missing'}`);
      console.log(`  Verifying key: ${verifyingKeyExists ? '✓ Present' : '✗ Missing'}`);
      console.log(`  Key directory: ${args['key-dir']}`);
      
      if (!signingKeyExists || !verifyingKeyExists) {
        logger.info('\nGenerate keys with: kgen attest keys --generate');
      }
      
    } catch (error) {
      logger.error('Failed to manage keys:', error);
      process.exit(1);
    }
  }
});

/**
 * Trust policy management command
 */
export const policyCommand = defineCommand({
  meta: {
    name: 'policy',
    description: 'Manage trust policy for attestation verification'
  },
  args: {
    validate: {
      type: 'string',
      description: 'Validate trust policy file'
    },
    create: {
      type: 'string',
      description: 'Create example trust policy file'
    },
    show: {
      type: 'string',
      description: 'Show trust policy details',
      default: 'trust-policy.json'
    }
  },
  async run({ args }) {
    try {
      const system = new AttestationSystem();
      const cli = new AttestationCLI(system);
      
      if (args.validate) {
        await cli.validateTrustPolicy(args.validate);
        return;
      }
      
      if (args.create) {
        logger.info(`Creating example trust policy: ${args.create}`);
        
        // Copy example trust policy
        const examplePath = path.join(__dirname, 'trust-policy.example.json');
        const exampleContent = await fs.readFile(examplePath, 'utf8');
        
        await fs.writeFile(args.create, exampleContent);
        logger.success(`Example trust policy created: ${args.create}`);
        logger.info('Edit the file to customize for your organization');
        
        return;
      }
      
      if (args.show) {
        try {
          const policyContent = await fs.readFile(args.show, 'utf8');
          const policy = JSON.parse(policyContent);
          
          logger.info(`Trust Policy: ${args.show}`);
          console.log(`  Version: ${policy.version}`);
          console.log(`  Name: ${policy.metadata?.name || 'Unnamed'}`);
          console.log(`  Trusted signers: ${policy.trustedSigners?.length || 0}`);
          console.log(`  Required signatures: ${policy.requiredSignatures}`);
          console.log(`  SLSA level: ${policy.slsaLevel}`);
          console.log(`  Predicate types: ${policy.allowedPredicateTypes?.length || 0}`);
          
          if (policy.additionalChecks) {
            console.log('  Additional checks:');
            Object.entries(policy.additionalChecks).forEach(([key, value]) => {
              console.log(`    ${key}: ${JSON.stringify(value)}`);
            });
          }
          
        } catch (error) {
          logger.error(`Trust policy not found: ${args.show}`);
          logger.info('Create one with: kgen attest policy --create trust-policy.json');
        }
        
        return;
      }
      
      logger.error('Must specify --validate, --create, or --show');
      process.exit(1);
      
    } catch (error) {
      logger.error('Failed to manage policy:', error);
      process.exit(1);
    }
  }
});

/**
 * Status command
 */
export const statusCommand = defineCommand({
  meta: {
    name: 'status',
    description: 'Show attestation system status'
  },
  args: {
    verbose: {
      type: 'boolean',
      description: 'Show detailed status information',
      alias: 'v'
    }
  },
  async run({ args }) {
    try {
      const system = new AttestationSystem();
      await system.initialize();
      
      const stats = system.getStatistics();
      
      logger.info('Attestation System Status:');
      console.log(`  Initialized: ${stats.initialized ? '✓' : '✗'}`);
      
      if (stats.initialized) {
        console.log('\nGenerator:');
        if (stats.generator) {
          console.log(`  State: ${stats.generator.state || 'unknown'}`);
        }
        
        console.log('\nVerifier:');
        if (stats.verifier) {
          console.log(`  Cache size: ${stats.verifier.cacheSize}`);
          console.log(`  Trust policy loaded: ${stats.verifier.trustPolicyLoaded ? '✓' : '✗'}`);
        }
        
        console.log('\nGit Notes:');
        if (stats.gitNotes) {
          console.log(`  Receipts directory: ${stats.gitNotes.receiptsDirectory}`);
        }
      }
      
      if (args.verbose) {
        console.log('\nConfiguration:');
        console.log(JSON.stringify(stats.config, null, 2));
      }
      
    } catch (error) {
      logger.error('Failed to get status:', error);
      process.exit(1);
    }
  }
});

/**
 * Cleanup command
 */
export const cleanupCommand = defineCommand({
  meta: {
    name: 'cleanup',
    description: 'Clean up old attestation receipts and caches'
  },
  args: {
    'older-than': {
      type: 'number',
      description: 'Remove receipts older than N days',
      default: 30
    },
    'keep-minimum': {
      type: 'number',
      description: 'Keep at least N receipts per commit',
      default: 5
    },
    'clear-cache': {
      type: 'boolean',
      description: 'Clear verification cache',
      default: false
    },
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be cleaned without actually cleaning',
      default: false
    }
  },
  async run({ args }) {
    try {
      const system = new AttestationSystem();
      await system.initialize();
      
      if (args['dry-run']) {
        logger.info('Dry run mode - no changes will be made');
      }
      
      if (args['clear-cache']) {
        if (!args['dry-run']) {
          system.clearCaches();
        }
        logger.info('Verification cache cleared');
      }
      
      if (!args['dry-run']) {
        const cleanedCount = await system.cleanupReceipts({
          olderThanDays: args['older-than'],
          keepMinimum: args['keep-minimum']
        });
        
        logger.success(`Cleaned up ${cleanedCount} old receipts`);
      } else {
        logger.info(`Would clean receipts older than ${args['older-than']} days`);
        logger.info(`Would keep minimum ${args['keep-minimum']} receipts per commit`);
      }
      
    } catch (error) {
      logger.error('Failed to cleanup:', error);
      process.exit(1);
    }
  }
});

/**
 * Integration hook for kgen commands
 * 
 * This function should be called after every artifact generation
 * to automatically create attestations.
 */
export async function generateAttestationHook(
  artifactPath: string,
  context: {
    command?: string;
    args?: string[];
    templatePath?: string;
    variables?: Record<string, any>;
    workingDirectory?: string;
  }
): Promise<void> {
  try {
    // Check if attestation is enabled
    const enableAttestation = process.env.KGEN_ENABLE_ATTESTATION !== 'false';
    if (!enableAttestation) {
      return;
    }
    
    logger.info(`Generating attestation for: ${artifactPath}`);
    
    const system = new AttestationSystem({
      generator: {
        timestampSource: 'deterministic'
      },
      enableAutoVerification: true
    });
    
    await system.generateAttestation(artifactPath, {
      command: context.command || 'kgen',
      args: context.args || [],
      templatePath: context.templatePath,
      variables: context.variables || {},
      workingDirectory: context.workingDirectory || process.cwd(),
      environment: process.env as Record<string, string>
    });
    
  } catch (error) {
    // Don't fail the main command if attestation fails
    logger.warn('Failed to generate attestation:', error.message);
  }
}

export default attestationCommand;