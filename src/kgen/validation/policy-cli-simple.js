/**
 * KGEN Simple Policy CLI - Command Line Interface for Policy Gates
 * 
 * Uses the simplified policy resolver for demonstration purposes.
 */

import { SimplePolicyURIResolver, PolicyURISchemes, PolicyVerdict } from './policy-resolver-simple.js';
import fs from 'fs-extra';
import path from 'path';
import { defineCommand } from 'citty';
import consola from 'consola';

/**
 * Simple Policy CLI Commands
 */
export const simplePolicyCommands = {
  /**
   * Policy resolution command
   */
  resolve: defineCommand({
    meta: {
      name: 'resolve',
      description: 'Resolve policy:// URI and get machine verdict (simple version)'
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
      verbose: {
        type: 'boolean',
        description: 'Enable verbose output',
        alias: 'v'
      }
    },
    async run({ args }) {
      try {
        const resolver = new SimplePolicyURIResolver({ 
          logger: consola.withTag('policy-resolve-simple')
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
        
        // Resolve policy URI
        const result = await resolver.resolvePolicyURI(args.uri, context);
        
        const response = {
          success: true,
          operation: 'policy:resolve:simple',
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
        const exitCode = result.passed ? 0 : 3;
        process.exit(exitCode);
        
      } catch (error) {
        const response = {
          success: false,
          operation: 'policy:resolve:simple',
          policyURI: args.uri,
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        };
        
        console.log(JSON.stringify(response, null, 2));
        process.exit(1);
      }
    }
  }),

  /**
   * List available policies command
   */
  list: defineCommand({
    meta: {
      name: 'list',
      description: 'List available policy rules (simple version)'
    },
    async run({ args }) {
      try {
        const response = {
          success: true,
          operation: 'policy:list:simple',
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
        
        console.log(JSON.stringify(response, null, 2));
        
      } catch (error) {
        const response = {
          success: false,
          operation: 'policy:list:simple',
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
      description: 'View policy audit trails (simple version)'
    },
    args: {
      action: {
        type: 'string',
        description: 'Action to perform (view|export|stats)',
        default: 'stats'
      },
      limit: {
        type: 'number',
        description: 'Limit number of entries to show',
        default: 10
      }
    },
    async run({ args }) {
      try {
        const resolver = new SimplePolicyURIResolver();
        await resolver.initialize();
        
        if (args.action === 'stats') {
          const stats = resolver.getVerdictStatistics();
          
          const response = {
            success: true,
            operation: 'policy:audit:simple',
            action: 'stats',
            statistics: stats,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
          console.log(JSON.stringify(response, null, 2));
          
        } else if (args.action === 'export') {
          const exportPath = await resolver.exportAuditTrail('json');
          
          const response = {
            success: true,
            operation: 'policy:audit:simple',
            action: 'export',
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
          operation: 'policy:audit:simple',
          action: args.action,
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
 * Main simple policy command
 */
export const simplePolicyCommand = defineCommand({
  meta: {
    name: 'policy-simple',
    description: 'Simple policy gates for automated governance (demo version)'
  },
  subCommands: simplePolicyCommands
});

export default simplePolicyCommand;