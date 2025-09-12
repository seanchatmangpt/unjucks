/**
 * KGEN Policy CLI - Command Line Interface for Policy Gates
 * 
 * Provides CLI commands for policy:// URI resolution and machine verdicts.
 */

import { PolicyGates, PolicyGateConfig } from './policy-gates.js';
import { PolicyURIResolver, PolicyURISchemes, PolicyVerdict } from './policy-resolver.js';
import { SHACLValidationCodes } from './shacl-validation-engine.js';
import fs from 'fs-extra';
import path from 'path';
import { defineCommand } from 'citty';
import consola from 'consola';

/**
 * Policy CLI Commands
 */
export const policyCommands = {
  /**
   * Policy resolution command
   */
  resolve: defineCommand({
    meta: {
      name: 'resolve',
      description: 'Resolve policy:// URI and get machine verdict'
    },
    args: {
      uri: {
        type: 'positional',
        description: 'Policy URI (e.g., policy://template-security/pass)',
        required: true
      },
      context: {
        type: 'string',
        description: 'JSON context for policy evaluation',
        alias: 'c'
      },
      template: {
        type: 'string',
        description: 'Template file path for template policies',
        alias: 't'
      },
      artifact: {
        type: 'string',
        description: 'Artifact file path for artifact policies',
        alias: 'a'
      },
      data: {
        type: 'string',
        description: 'RDF data file path for SHACL policies',
        alias: 'd'
      },
      verbose: {
        type: 'boolean',
        description: 'Enable verbose output',
        alias: 'v'
      }
    },
    async run({ args }) {
      try {
        const resolver = new PolicyURIResolver({ 
          logger: consola.withTag('policy-resolve'),
          verbose: args.verbose 
        });
        
        await resolver.initialize();
        
        // Build context from arguments
        const context = {};
        
        if (args.context) {
          Object.assign(context, JSON.parse(args.context));
        }
        
        if (args.template) {
          context.templatePath = args.template;
          if (await fs.pathExists(args.template)) {
            context.templateContent = await fs.readFile(args.template, 'utf8');
            context.templateName = path.basename(args.template, path.extname(args.template));
          }
        }
        
        if (args.artifact) {
          context.artifactPath = args.artifact;
        }
        
        if (args.data) {
          context.dataPath = args.data;
          if (await fs.pathExists(args.data)) {
            context.dataGraph = await fs.readFile(args.data, 'utf8');
          }
        }
        
        // Resolve policy URI
        const result = await resolver.resolvePolicyURI(args.uri, context);
        
        const response = {
          success: true,
          operation: 'policy:resolve',
          policyURI: args.uri,
          verdict: result.actualVerdict,
          passed: result.passed,
          verdictMatches: result.verdictMatches,
          ruleResult: result.ruleResult,
          metadata: result.metadata,
          timestamp: this.getDeterministicDate().toISOString()
        };
        
        if (!result.passed || result.error) {
          response.error = result.error;
          response.violations = result.ruleResult?.violations || [];
        }
        
        console.log(JSON.stringify(response, null, 2));
        
        // Exit with appropriate code
        const exitCode = result.passed ? 0 : SHACLValidationCodes.VIOLATIONS;
        process.exit(exitCode);
        
      } catch (error) {
        const response = {
          success: false,
          operation: 'policy:resolve',
          policyURI: args.uri,
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        };
        
        console.log(JSON.stringify(response, null, 2));
        process.exit(SHACLValidationCodes.ERRORS);
      }
    }
  }),

  /**
   * Policy gate execution command
   */
  gate: defineCommand({
    meta: {
      name: 'gate',
      description: 'Execute policy gate with machine verdicts'
    },
    args: {
      name: {
        type: 'positional',
        description: 'Gate name or identifier',
        required: true
      },
      environment: {
        type: 'string',
        description: 'Deployment environment (development|staging|production|compliance)',
        alias: 'e',
        default: 'development'
      },
      data: {
        type: 'string',
        description: 'RDF data file for validation',
        alias: 'd'
      },
      template: {
        type: 'string',
        description: 'Template file for validation',
        alias: 't'
      },
      artifact: {
        type: 'string',
        description: 'Artifact file for validation',
        alias: 'a'
      },
      context: {
        type: 'string',
        description: 'JSON context for gate execution',
        alias: 'c'
      },
      'exit-on-failure': {
        type: 'boolean',
        description: 'Exit with error code on gate failure',
        default: true
      },
      verbose: {
        type: 'boolean',
        description: 'Enable verbose output',
        alias: 'v'
      }
    },
    async run({ args }) {
      try {
        const gates = new PolicyGates({
          logger: consola.withTag('policy-gate'),
          environment: args.environment,
          exitOnFailure: args['exit-on-failure'],
          verbose: args.verbose
        });
        
        await gates.initialize();
        
        // Build execution context
        const context = {};
        
        if (args.context) {
          Object.assign(context, JSON.parse(args.context));
        }
        
        if (args.data) {
          context.dataPath = args.data;
        }
        
        if (args.template) {
          context.templatePath = args.template;
          if (await fs.pathExists(args.template)) {
            context.templateContent = await fs.readFile(args.template, 'utf8');
            context.templateName = path.basename(args.template, path.extname(args.template));
          }
        }
        
        if (args.artifact) {
          context.artifactPath = args.artifact;
        }
        
        // Execute gate
        const result = await gates.executeGate(args.name, context);
        
        const response = {
          success: result.passed,
          operation: 'policy:gate',
          gateName: args.name,
          environment: args.environment,
          verdict: result.passed ? 'PASS' : 'FAIL',
          blocked: result.blocked,
          policyVerdicts: result.policyVerdicts?.map(p => ({
            uri: p.policyURI,
            verdict: p.actualVerdict,
            passed: p.passed
          })) || [],
          shaclResults: result.shaclResults ? {
            passed: result.shaclResults.passed,
            violations: result.shaclResults.violations || 0
          } : null,
          executionTime: result.metadata?.executionTime,
          auditEntry: result.auditEntry?.id,
          timestamp: result.metadata?.executedAt
        };
        
        if (!result.passed || result.error) {
          response.error = result.error;
          response.decision = result.decision;
        }
        
        console.log(JSON.stringify(response, null, 2));
        
        // Exit handled by gates system if exitOnFailure is true
        if (!args['exit-on-failure']) {
          process.exit(result.passed ? 0 : SHACLValidationCodes.VIOLATIONS);
        }
        
      } catch (error) {
        const response = {
          success: false,
          operation: 'policy:gate',
          gateName: args.name,
          environment: args.environment,
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        };
        
        console.log(JSON.stringify(response, null, 2));
        process.exit(SHACLValidationCodes.ERRORS);
      }
    }
  }),

  /**
   * List available policies command
   */
  list: defineCommand({
    meta: {
      name: 'list',
      description: 'List available policy rules and gate configurations'
    },
    args: {
      type: {
        type: 'string',
        description: 'Type to list (policies|gates|environments)',
        default: 'policies'
      }
    },
    async run({ args }) {
      try {
        let response;
        
        if (args.type === 'policies') {
          response = {
            success: true,
            operation: 'policy:list',
            type: 'policies',
            availablePolicies: Object.entries(PolicyURISchemes).map(([name, id]) => ({
              name: name.toLowerCase().replace('_', '-'),
              id,
              uriExamples: [
                `policy://${id}/pass`,
                `policy://${id}/fail`
              ]
            })),
            timestamp: this.getDeterministicDate().toISOString()
          };
        } else if (args.type === 'gates') {
          response = {
            success: true,
            operation: 'policy:list',
            type: 'gates',
            availableGates: ['pre-build', 'artifact-generation', 'post-build', 'release'],
            gateMapping: {
              'development': 'pre-build',
              'staging': 'artifact-generation', 
              'production': 'release',
              'compliance': 'release'
            },
            timestamp: this.getDeterministicDate().toISOString()
          };
        } else if (args.type === 'environments') {
          response = {
            success: true,
            operation: 'policy:list',
            type: 'environments',
            environments: Object.entries(PolicyGateConfig).map(([name, config]) => ({
              name: name.toLowerCase(),
              config: {
                strictMode: config.strictMode,
                blockOnPolicyFailure: config.blockOnPolicyFailure,
                blockOnSecurityViolations: config.blockOnSecurityViolations,
                auditLevel: config.auditLevel,
                requiredPolicies: config.requiredPolicies
              }
            })),
            timestamp: this.getDeterministicDate().toISOString()
          };
        } else {
          throw new Error(`Unknown list type: ${args.type}`);
        }
        
        console.log(JSON.stringify(response, null, 2));
        
      } catch (error) {
        const response = {
          success: false,
          operation: 'policy:list',
          type: args.type,
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        };
        
        console.log(JSON.stringify(response, null, 2));
        process.exit(1);
      }
    }
  }),

  /**
   * Audit trail command
   */
  audit: defineCommand({
    meta: {
      name: 'audit',
      description: 'View and export policy audit trails'
    },
    args: {
      action: {
        type: 'string',
        description: 'Action to perform (view|export|stats)',
        default: 'view'
      },
      format: {
        type: 'string',
        description: 'Export format (json|csv)',
        default: 'json'
      },
      limit: {
        type: 'number',
        description: 'Limit number of entries to show',
        default: 10
      },
      'audit-path': {
        type: 'string',
        description: 'Path to audit directory',
        default: './.kgen/audit/policy-gates'
      }
    },
    async run({ args }) {
      try {
        const auditPath = args['audit-path'];
        
        if (args.action === 'view') {
          // List recent audit entries
          const auditFiles = await fs.readdir(auditPath).catch(() => []);
          const recentFiles = auditFiles
            .filter(f => f.startsWith('gate-') && f.endsWith('.json'))
            .sort()
            .slice(-args.limit);
          
          const auditEntries = [];
          for (const file of recentFiles) {
            const entry = await fs.readJson(path.join(auditPath, file));
            auditEntries.push(entry);
          }
          
          const response = {
            success: true,
            operation: 'policy:audit',
            action: 'view',
            auditPath,
            entries: auditEntries,
            totalFiles: auditFiles.length,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(response, null, 2));
          
        } else if (args.action === 'stats') {
          // Calculate audit statistics
          const resolver = new PolicyURIResolver({ auditPath });
          await resolver.initialize();
          
          const stats = resolver.getVerdictStatistics();
          
          const response = {
            success: true,
            operation: 'policy:audit',
            action: 'stats',
            auditPath,
            statistics: stats,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(response, null, 2));
          
        } else if (args.action === 'export') {
          // Export audit trail
          const resolver = new PolicyURIResolver({ auditPath });
          await resolver.initialize();
          
          const exportPath = await resolver.exportAuditTrail(args.format);
          
          const response = {
            success: true,
            operation: 'policy:audit',
            action: 'export',
            format: args.format,
            exportPath,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(response, null, 2));
          
        } else {
          throw new Error(`Unknown audit action: ${args.action}`);
        }
        
      } catch (error) {
        const response = {
          success: false,
          operation: 'policy:audit',
          action: args.action,
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        };
        
        console.log(JSON.stringify(response, null, 2));
        process.exit(1);
      }
    }
  }),

  /**
   * Validate policy configuration command
   */
  validate: defineCommand({
    meta: {
      name: 'validate',
      description: 'Validate policy configuration and rules'
    },
    args: {
      'rules-path': {
        type: 'string',
        description: 'Path to custom rules directory',
        default: './rules'
      },
      'shapes-path': {
        type: 'string',
        description: 'Path to SHACL shapes directory', 
        default: './src/kgen/validation/shapes'
      }
    },
    async run({ args }) {
      try {
        const resolver = new PolicyURIResolver({
          rulesPath: args['rules-path'],
          shapesPath: args['shapes-path']
        });
        
        await resolver.initialize();
        
        // Validate all built-in policy schemes
        const validationResults = [];
        
        for (const [name, id] of Object.entries(PolicyURISchemes)) {
          try {
            // Test policy URI parsing
            const parseResult = resolver.parsePolicyURI(`policy://${id}/pass`);
            
            validationResults.push({
              policy: name.toLowerCase(),
              id,
              parseValid: parseResult.isValid,
              error: parseResult.error || null
            });
            
          } catch (error) {
            validationResults.push({
              policy: name.toLowerCase(),
              id,
              parseValid: false,
              error: error.message
            });
          }
        }
        
        const response = {
          success: true,
          operation: 'policy:validate',
          rulesPath: args['rules-path'],
          shapesPath: args['shapes-path'],
          validationResults,
          summary: {
            totalPolicies: validationResults.length,
            validPolicies: validationResults.filter(r => r.parseValid).length,
            invalidPolicies: validationResults.filter(r => !r.parseValid).length
          },
          timestamp: this.getDeterministicDate().toISOString()
        };
        
        console.log(JSON.stringify(response, null, 2));
        
        const exitCode = response.summary.invalidPolicies > 0 ? 1 : 0;
        process.exit(exitCode);
        
      } catch (error) {
        const response = {
          success: false,
          operation: 'policy:validate',
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        };
        
        console.log(JSON.stringify(response, null, 2));
        process.exit(1);
      }
    }
  })
};

/**
 * Main policy command with subcommands
 */
export const policyCommand = defineCommand({
  meta: {
    name: 'policy',
    description: 'Policy gates and machine verdicts for automated governance'
  },
  subCommands: policyCommands
});

export default policyCommand;
