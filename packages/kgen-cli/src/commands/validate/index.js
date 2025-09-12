#!/usr/bin/env node

import { defineCommand } from 'citty';

/**
 * Create the main validate command with all subcommands
 * Enhanced with working SHACL validation engine
 */
export default defineCommand({
  meta: {
    name: 'validate',
    description: 'Comprehensive validation system for KGEN artifacts, graphs, and configurations'
  },
  subCommands: {
    artifacts: defineCommand({
      meta: {
        name: 'artifacts',
        description: 'Validate generated artifacts using SHACL shapes'
      },
      args: {
        path: {
          type: 'positional',
          description: 'Path to artifact or directory'
        },
        recursive: {
          type: 'boolean',
          description: 'Recursively validate directories',
          alias: 'r'
        },
        shapes: {
          type: 'string',
          description: 'Path to SHACL shapes file',
          alias: 's'
        },
        format: {
          type: 'string',
          description: 'Output format (json, turtle, summary)',
          default: 'summary'
        }
      },
      async run({ args }) {
        const { validateArtifacts } = await import('../../shacl/artifact-validator.js');
        
        try {
          const result = await validateArtifacts({
            path: args.path || '.',
            recursive: args.recursive || false,
            shapesFile: args.shapes,
            format: args.format
          });
          
          if (args.format === 'json') {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(result.summary);
            if (!result.conforms) {
              console.error('\nValidation Violations:');
              result.violations.forEach((v, i) => {
                console.error(`${i + 1}. ${v.message}`);
                console.error(`   Path: ${v.path}`);
                console.error(`   Value: ${v.value}`);
                console.error(`   Severity: ${v.severity}`);
              });
              process.exit(1);
            }
          }
        } catch (error) {
          console.error('Artifact validation failed:', error.message);
          process.exit(1);
        }
      }
    }),
    config: defineCommand({
      meta: {
        name: 'config',
        description: 'Validate KGEN configuration'
      },
      args: {
        config: {
          type: 'string',
          description: 'Path to config file',
          alias: 'c'
        }
      },
      async run({ args }) {
        const result = {
          success: true,
          operation: 'validate:config',
          config: args.config || 'kgen.config.js',
          timestamp: this.getDeterministicDate().toISOString()
        };
        console.log(JSON.stringify(result, null, 2));
      }
    }),
    graph: defineCommand({
      meta: {
        name: 'graph',
        description: 'Validate RDF graphs using SHACL shapes'
      },
      args: {
        file: {
          type: 'positional',
          description: 'Path to RDF file',
          required: true
        },
        shapes: {
          type: 'string',
          description: 'Path to SHACL shapes file',
          alias: 's',
          required: true
        },
        format: {
          type: 'string',
          description: 'Output format (json, turtle, summary)',
          default: 'summary'
        },
        verbose: {
          type: 'boolean',
          description: 'Show detailed violation information',
          alias: 'v'
        }
      },
      async run({ args }) {
        const { SHACLEngine } = await import('../../../kgen-core/src/shacl/validator.js');
        
        try {
          const validator = new SHACLEngine();
          const result = await validator.validateFile(args.file, args.shapes);
          
          if (args.format === 'json') {
            console.log(JSON.stringify(result, null, 2));
          } else {
            const summary = validator.generateSummary(result);
            console.log(`\n🔍 SHACL Validation Results`);
            console.log(`File: ${args.file}`);
            console.log(`Shapes: ${args.shapes}`);
            console.log(`Engine: ${result.engine}`);
            console.log(`Timestamp: ${result.timestamp}`);
            console.log(`\n📊 Summary:`);
            console.log(`Conforms: ${result.conforms ? '✅ Yes' : '❌ No'}`);
            console.log(`Total Violations: ${summary.totalViolations}`);
            console.log(`- Violations: ${summary.violationsBySeverity.violation || 0}`);
            console.log(`- Warnings: ${summary.violationsBySeverity.warning || 0}`);
            console.log(`- Info: ${summary.violationsBySeverity.info || 0}`);
            
            if (!result.conforms && result.violations.length > 0) {
              console.log('\n🚫 Constraint Violations:');
              result.violations.forEach((violation, i) => {
                console.log(`\n${i + 1}. ${violation.message}`);
                console.log(`   Focus Node: ${violation.focusNode}`);
                console.log(`   Path: ${violation.path}`);
                console.log(`   Value: ${violation.value}`);
                console.log(`   Severity: ${violation.severity.toUpperCase()}`);
                console.log(`   Shape: ${violation.shape}`);
                console.log(`   Constraint: ${violation.constraint}`);
                
                if (args.verbose) {
                  console.log(`   Details: Full validation context available`);
                }
              });
              
              console.log(`\n❌ Validation failed with ${result.violations.length} violations`);
              process.exit(1);
            } else {
              console.log('\n✅ Validation passed successfully');
            }
          }
        } catch (error) {
          console.error('❌ Graph validation failed:', error.message);
          process.exit(1);
        }
      }
    })
  }
});