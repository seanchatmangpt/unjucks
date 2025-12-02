#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { SHACLValidationEngine } from '@kgen/rules/src/validator/shacl.js';
import { SHACLShapesManager } from '@kgen/rules/src/validator/shapes.js';
import chalk from 'chalk';

/**
 * Create validate graph command
 * @returns {Command} The configured validate graph command
 */
export function createValidateGraphCommand() {
  return new Command('graph')
    .description('Validate RDF graphs against SHACL shapes and semantic constraints')
    .argument('<dataGraph>', 'Path to RDF data graph file')
    .option('-s, --shapes <shapesFile>', 'Path to SHACL shapes file')
    .option('-f, --format <format>', 'RDF format (turtle, n3, jsonld, ntriples)', 'turtle')
    .option('-o, --output <file>', 'Output validation report to file')
    .option('--json', 'Output results in JSON format')
    .option('--conforms-only', 'Only check if graph conforms (boolean result)')
    .option('-v, --verbose', 'Show detailed validation information')
    .option('--exit-code', 'Exit with non-zero code if validation fails')
    .action(async (dataGraph, options) => {
      const startTime = Date.now();
      
      try {
        console.log(chalk.blue('🔍 Graph Validation'));
        console.log(chalk.blue('━'.repeat(30)));

        // Zero-tick reject: validate inputs immediately
        if (!dataGraph) {
          console.error(chalk.red('❌ Error: Data graph path is required'));
          if (options.exitCode) process.exit(1);
          return;
        }

        // Check data graph exists
        const dataGraphPath = resolve(dataGraph);
        if (!existsSync(dataGraphPath)) {
          console.error(chalk.red(`❌ Error: Data graph file not found: ${dataGraph}`));
          if (options.exitCode) process.exit(1);
          return;
        }

        console.log(chalk.blue(`📊 Loading data graph: ${dataGraph}`));
        let dataContent;
        try {
          dataContent = readFileSync(dataGraphPath, 'utf8');
          if (!dataContent.trim()) {
            throw new Error('Data graph file is empty');
          }
        } catch (error) {
          console.error(chalk.red(`❌ Error loading data graph: ${error.message}`));
          if (options.exitCode) process.exit(1);
          return;
        }
        console.log(chalk.green(`  ✓ Loaded data graph (${dataContent.length} characters)`));

        let results;
        if (options.shapes) {
          // SHACL validation path
          const shapesPath = resolve(options.shapes);
          if (!existsSync(shapesPath)) {
            console.error(chalk.red(`❌ Error: SHACL shapes file not found: ${options.shapes}`));
            if (options.exitCode) process.exit(1);
            return;
          }

          console.log(chalk.blue(`📋 Loading SHACL shapes: ${options.shapes}`));
          let shapesContent;
          try {
            shapesContent = readFileSync(shapesPath, 'utf8');
            if (!shapesContent.trim()) {
              throw new Error('SHACL shapes file is empty');
            }
          } catch (error) {
            console.error(chalk.red(`❌ Error loading SHACL shapes: ${error.message}`));
            if (options.exitCode) process.exit(1);
            return;
          }
          console.log(chalk.green(`  ✓ Loaded SHACL shapes (${shapesContent.length} characters)`));

          console.log(chalk.blue('⚡ Running SHACL validation...'));
          
          // Initialize SHACL validation engine
          const validationEngine = new SHACLValidationEngine();
          
          try {
            const validationResult = await validationEngine.validateGraph(
              dataContent, 
              shapesContent, 
              {
                maxErrors: options.maxErrors || -1,
                debug: options.verbose || false,
                cacheKey: `${dataGraph}-${options.shapes}`
              }
            );

            // Convert to CLI format with zero-tick reject semantics
            results = {
              ok: validationResult.conforms,
              conforms: validationResult.conforms,
              violations: validationResult.violations || [],
              warnings: validationResult.warnings || [],
              shapesCount: validationResult.shapesCount || 0,
              validatedNodes: validationResult.dataTriples || 0,
              validationTime: validationResult.executionTime,
              metadata: validationResult.metadata
            };

            console.log(chalk.green(`  ✓ SHACL validation completed (${validationResult.executionTime}ms)`));
            
          } catch (validationError) {
            // Zero-tick reject: immediate failure response
            console.error(chalk.red(`❌ SHACL validation failed: ${validationError.message}`));
            
            results = {
              ok: false,
              conforms: false,
              violations: [{
                type: 'ValidationEngineError',
                message: validationError.message,
                severity: 'critical',
                focusNode: null,
                resultPath: null,
                value: null
              }],
              warnings: [],
              shapesCount: 0,
              validatedNodes: 0,
              validationTime: Date.now() - startTime,
              error: true
            };
          }
          
        } else {
          // Basic graph validation without SHACL (syntax check only)
          console.log(chalk.yellow('⚠️  No SHACL shapes provided - performing basic syntax validation'));
          
          const shapesManager = new SHACLShapesManager();
          try {
            // Try to parse the data to verify it's valid RDF
            const parsed = await shapesManager.parseShapes(dataContent);
            
            results = {
              ok: true,
              conforms: true,
              violations: [],
              warnings: [{
                type: 'NoShapesProvided',
                message: 'Only basic syntax validation performed - no SHACL constraints checked',
                severity: 'info'
              }],
              shapesCount: 0,
              validatedNodes: parsed.size,
              basicValidation: true,
              validationTime: Date.now() - startTime
            };
            
            console.log(chalk.green(`  ✓ Basic syntax validation passed (${parsed.size} triples)`));
            
          } catch (parseError) {
            // Zero-tick reject: immediate parse failure
            console.error(chalk.red(`❌ RDF syntax validation failed: ${parseError.message}`));
            
            results = {
              ok: false,
              conforms: false,
              violations: [{
                type: 'SyntaxError',
                message: `Invalid RDF syntax: ${parseError.message}`,
                severity: 'critical',
                focusNode: null,
                resultPath: null,
                value: null
              }],
              warnings: [],
              shapesCount: 0,
              validatedNodes: 0,
              basicValidation: true,
              validationTime: Date.now() - startTime,
              error: true
            };
          }
        }

        // Display results
        console.log(chalk.blue('\n📊 Validation Results'));
        console.log(chalk.blue('━'.repeat(25)));
        
        if (results.conforms) {
          console.log(chalk.green('✅ Graph conforms to constraints'));
        } else {
          console.log(chalk.red('❌ Graph does not conform to constraints'));
        }

        if (options.shapes) {
          console.log(`Shapes validated: ${results.shapesCount}`);
          console.log(`Nodes validated: ${results.validatedNodes}`);
          if (results.validationTime) {
            console.log(`Validation time: ${results.validationTime}ms`);
          }
        }
        
        console.log(`Violations: ${chalk.red(results.violations.length)}`);
        console.log(`Warnings: ${chalk.yellow(results.warnings.length)}`);

        // Show violations
        if (results.violations.length > 0 && !options.conformsOnly) {
          console.log(chalk.red('\n🚫 Constraint Violations:'));
          console.log(chalk.red('━'.repeat(25)));
          
          results.violations.forEach((violation, index) => {
            console.log(chalk.red(`${index + 1}. ${violation.type}`));
            if (violation.focusNode) {
              console.log(chalk.gray(`   Focus Node: ${violation.focusNode}`));
            }
            if (violation.resultPath) {
              console.log(chalk.gray(`   Property: ${violation.resultPath}`));
            }
            if (violation.value) {
              console.log(chalk.gray(`   Value: ${violation.value}`));
            }
            console.log(chalk.gray(`   Message: ${violation.message}`));
            console.log('');
          });
        }

        // JSON output
        if (options.json) {
          const jsonResult = {
            ok: results.ok,
            conforms: results.conforms,
            violations: results.violations,
            warnings: results.warnings,
            summary: {
              shapesCount: results.shapesCount,
              validatedNodes: results.validatedNodes,
              violationCount: results.violations.length,
              warningCount: results.warnings.length,
              validationTime: results.validationTime
            },
            timestamp: new Date().toISOString()
          };

          if (options.output) {
            const fs = await import('fs/promises');
            await fs.writeFile(options.output, JSON.stringify(jsonResult, null, 2));
            console.log(chalk.blue(`📄 Results written to: ${options.output}`));
          } else {
            console.log(chalk.blue('\n📄 JSON Results:'));
            console.log(JSON.stringify(jsonResult, null, 2));
          }
        }

        if (options.conformsOnly) {
          console.log(results.conforms ? 'true' : 'false');
        }

        // Zero-tick reject: immediate exit on validation failure
        if (options.exitCode && !results.conforms) {
          process.exit(1);
        }

      } catch (error) {
        console.error(chalk.red('❌ Graph validation failed:'), error.message);
        
        // Zero-tick reject: always exit with error code when using --exit-code
        if (options.exitCode) {
          process.exit(1);
        }
      }
    });
}