/**
 * KGEN Git-First CLI Commands
 * 
 * Provides CLI commands for git-first workflow including:
 * - Blob-based artifact generation
 * - Git notes provenance management
 * - Content addressing and verification
 * - Semantic drift detection using git diff
 */

import { defineCommand } from 'citty';
import path from 'path';
import fs from 'fs-extra';
import { createGitFirstWorkflow } from '../../packages/kgen-core/src/git/index.js';

/**
 * Git-first artifact generation command
 */
export const gitArtifactCommand = defineCommand({
  meta: {
    name: 'git-artifact',
    description: 'Git-first artifact generation with blob-based content addressing'
  },
  subCommands: {
    generate: defineCommand({
      meta: {
        name: 'generate',
        description: 'Generate artifact using git-first workflow'
      },
      args: {
        template: {
          type: 'string',
          description: 'Template file path',
          alias: 't',
          required: true
        },
        context: {
          type: 'string',
          description: 'JSON context data',
          alias: 'c'
        },
        output: {
          type: 'string',
          description: 'Output file path',
          alias: 'o'
        },
        'content-addressing': {
          type: 'boolean',
          description: 'Enable content addressing with git SHA',
          default: true
        },
        'git-notes': {
          type: 'boolean',
          description: 'Force provenance storage in git notes',
          default: true
        },
        'repo-path': {
          type: 'string',
          description: 'Git repository path',
          default: '.'
        }
      },
      async run({ args }) {
        try {
          const startTime = this.getDeterministicTimestamp();
          
          console.log('🚀 Starting git-first artifact generation...');
          
          // Initialize git-first workflow
          const workflow = createGitFirstWorkflow({
            repoPath: path.resolve(args['repo-path']),
            enableContentAddressing: args['content-addressing'],
            forceGitNotes: args['git-notes']
          });
          
          const initResult = await workflow.initialize();
          if (!initResult.success) {
            throw new Error('Failed to initialize git-first workflow');
          }
          
          // Parse context
          const context = args.context ? JSON.parse(args.context) : {};
          
          // Generate artifact
          const result = await workflow.generateArtifact(
            args.template,
            context,
            args.output,
            {
              contentType: 'application/octet-stream',
              version: '1.0.0'
            }
          );
          
          const duration = this.getDeterministicTimestamp() - startTime;
          
          const response = {
            success: result.success,
            operation: 'git-artifact:generate',
            template: args.template,
            outputPath: args.output,
            gitFirst: true,
            artifact: {
              sha: result.artifact.sha,
              templateSha: result.artifact.templateSha,
              contextSha: result.artifact.contextSha
            },
            provenance: {
              stored: result.provenance.provenanceStored,
              activityId: result.provenance.activityId
            },
            contentAddressing: result.contentAddressing,
            performance: {
              duration: `${duration}ms`,
              target: duration <= 2000 ? '✅ Cold start ≤2s' : '❌ Cold start >2s'
            },
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(response, null, 2));
          return response;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'git-artifact:generate',
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    }),
    
    verify: defineCommand({
      meta: {
        name: 'verify',
        description: 'Verify git-first artifact integrity'
      },
      args: {
        artifact: {
          type: 'positional',
          description: 'Artifact SHA or file path',
          required: true
        },
        'check-reproducibility': {
          type: 'boolean',
          description: 'Check reproducibility context',
          default: true
        },
        'repo-path': {
          type: 'string',
          description: 'Git repository path',
          default: '.'
        }
      },
      async run({ args }) {
        try {
          console.log(`🔍 Verifying git-first artifact: ${args.artifact}`);
          
          const workflow = createGitFirstWorkflow({
            repoPath: path.resolve(args['repo-path'])
          });
          
          await workflow.initialize();
          
          const verification = await workflow.verifyArtifact(args.artifact);
          
          const result = {
            success: true,
            operation: 'git-artifact:verify',
            artifact: args.artifact,
            verified: verification.verified,
            blobExists: verification.blobExists,
            integrityVerified: verification.integrityVerified,
            reproducibilityCheck: verification.reproducibilityCheck,
            gitFirst: true,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'git-artifact:verify',
            artifact: args.artifact,
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    }),
    
    explain: defineCommand({
      meta: {
        name: 'explain',
        description: 'Explain git-first artifact with provenance from git notes'
      },
      args: {
        artifact: {
          type: 'positional',
          description: 'Artifact SHA',
          required: true
        },
        format: {
          type: 'string',
          description: 'Output format (json-ld, turtle, json)',
          default: 'json-ld'
        },
        'repo-path': {
          type: 'string',
          description: 'Git repository path',
          default: '.'
        }
      },
      async run({ args }) {
        try {
          console.log(`📖 Explaining git-first artifact: ${args.artifact}`);
          
          const workflow = createGitFirstWorkflow({
            repoPath: path.resolve(args['repo-path'])
          });
          
          await workflow.initialize();
          
          const explanation = await workflow.exportProvenance(args.artifact, args.format);
          
          const result = {
            success: true,
            operation: 'git-artifact:explain',
            artifact: args.artifact,
            format: args.format,
            explanation,
            gitFirst: true,
            source: 'git-notes',
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'git-artifact:explain',
            artifact: args.artifact,
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    })
  }
});

/**
 * Git-first drift detection command
 */
export const gitDriftCommand = defineCommand({
  meta: {
    name: 'git-drift',
    description: 'Git-aware drift detection using semantic git diff analysis'
  },
  subCommands: {
    detect: defineCommand({
      meta: {
        name: 'detect',
        description: 'Detect semantic drift using git diff'
      },
      args: {
        baseline: {
          type: 'string',
          description: 'Baseline commit SHA or artifact SHA',
          required: true
        },
        current: {
          type: 'string',
          description: 'Current commit SHA or artifact SHA',
          required: true
        },
        'semantic-analysis': {
          type: 'boolean',
          description: 'Enable semantic change analysis',
          default: true
        },
        'impact-threshold': {
          type: 'number',
          description: 'Impact score threshold for drift detection',
          default: 5.0
        },
        'repo-path': {
          type: 'string',
          description: 'Git repository path',
          default: '.'
        }
      },
      async run({ args }) {
        try {
          console.log(`🔍 Detecting git-first semantic drift: ${args.baseline} → ${args.current}`);
          
          const workflow = createGitFirstWorkflow({
            repoPath: path.resolve(args['repo-path'])
          });
          
          await workflow.initialize();
          
          const diff = await workflow.getArtifactDiff(args.baseline, args.current);
          
          const driftDetected = diff.semantic.impactScore >= args['impact-threshold'];
          
          const result = {
            success: true,
            operation: 'git-drift:detect',
            baseline: args.baseline,
            current: args.current,
            driftDetected,
            changes: diff.changes,
            semantic: diff.semantic,
            impactScore: diff.semantic.impactScore,
            threshold: args['impact-threshold'],
            gitFirst: true,
            recommendations: driftDetected ? [
              'Review structural changes carefully',
              'Consider impact on downstream artifacts',
              'Validate semantic consistency'
            ] : [
              'Changes appear semantic-safe',
              'Continue with current workflow'
            ],
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'git-drift:detect',
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    })
  }
});

/**
 * Git packfile command for distribution
 */
export const gitPackfileCommand = defineCommand({
  meta: {
    name: 'git-packfile',
    description: 'Create git packfiles for reproducible artifact distribution'
  },
  subCommands: {
    create: defineCommand({
      meta: {
        name: 'create',
        description: 'Create packfile from artifact SHAs'
      },
      args: {
        artifacts: {
          type: 'string',
          description: 'Comma-separated list of artifact SHAs',
          required: true
        },
        output: {
          type: 'string',
          description: 'Output packfile path',
          alias: 'o',
          required: true
        },
        'repo-path': {
          type: 'string',
          description: 'Git repository path',
          default: '.'
        }
      },
      async run({ args }) {
        try {
          const artifacts = args.artifacts.split(',').map(sha => sha.trim());
          
          console.log(`📦 Creating git packfile with ${artifacts.length} artifacts`);
          
          const workflow = createGitFirstWorkflow({
            repoPath: path.resolve(args['repo-path'])
          });
          
          await workflow.initialize();
          
          const packfile = await workflow.createDistributionPackfile(artifacts, args.output);
          
          const result = {
            success: packfile.success,
            operation: 'git-packfile:create',
            artifacts: artifacts.length,
            packfilePath: packfile.packfilePath,
            indexPath: packfile.indexPath,
            gitFirst: true,
            reproducible: true,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'git-packfile:create',
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    })
  }
});

/**
 * Git-first compliance command
 */
export const gitComplianceCommand = defineCommand({
  meta: {
    name: 'git-compliance',
    description: 'Git-first compliance reporting and audit trails'
  },
  subCommands: {
    report: defineCommand({
      meta: {
        name: 'report',
        description: 'Generate git-first compliance report'
      },
      args: {
        'start-date': {
          type: 'string',
          description: 'Start date (ISO format)',
        },
        'end-date': {
          type: 'string',
          description: 'End date (ISO format)',
        },
        format: {
          type: 'string',
          description: 'Report format (json, json-ld)',
          default: 'json'
        },
        'repo-path': {
          type: 'string',
          description: 'Git repository path',
          default: '.'
        }
      },
      async run({ args }) {
        try {
          console.log('📋 Generating git-first compliance report...');
          
          const workflow = createGitFirstWorkflow({
            repoPath: path.resolve(args['repo-path'])
          });
          
          await workflow.initialize();
          
          const criteria = {};
          if (args['start-date']) criteria.startDate = args['start-date'];
          if (args['end-date']) criteria.endDate = args['end-date'];
          
          const report = await workflow.generateComplianceReport(criteria);
          
          const result = {
            success: true,
            operation: 'git-compliance:report',
            format: args.format,
            report,
            gitFirst: true,
            storage: 'git-notes',
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'git-compliance:report',
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    })
  }
});

/**
 * Git performance command
 */
export const gitPerformanceCommand = defineCommand({
  meta: {
    name: 'git-perf',
    description: 'Git-first performance monitoring and optimization'
  },
  subCommands: {
    stats: defineCommand({
      meta: {
        name: 'stats',
        description: 'Get git-first performance statistics'
      },
      args: {
        'repo-path': {
          type: 'string',
          description: 'Git repository path',
          default: '.'
        }
      },
      async run({ args }) {
        try {
          console.log('⚡ Retrieving git-first performance statistics...');
          
          const workflow = createGitFirstWorkflow({
            repoPath: path.resolve(args['repo-path'])
          });
          
          await workflow.initialize();
          
          const stats = workflow.getPerformanceStats();
          
          const result = {
            success: true,
            operation: 'git-perf:stats',
            performance: stats,
            targets: {
              coldStart: '≤2s',
              p95RenderTime: '≤10ms'
            },
            gitFirst: true,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(result, null, 2));
          return result;
          
        } catch (error) {
          const result = {
            success: false,
            operation: 'git-perf:stats',
            error: error.message,
            timestamp: this.getDeterministicDate().toISOString()
          };
          console.log(JSON.stringify(result, null, 2));
          return result;
        }
      }
    })
  }
});

export default {
  gitArtifactCommand,
  gitDriftCommand,
  gitPackfileCommand,
  gitComplianceCommand,
  gitPerformanceCommand
};