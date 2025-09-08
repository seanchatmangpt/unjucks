#!/usr/bin/env node

/**
 * CLI for the specification validation system
 */

import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { SpecificationValidationPipeline } from './index.js';
import type { ValidationOptions } from './types/validation.types.js';

const program = new Command();

program
  .name('spec-validate')
  .description('Validate specifications against schemas, compliance standards, and best practices')
  .version('1.0.0');

// Single specification validation
program
  .command('validate')
  .description('Validate a single specification file')
  .argument('<file>', 'Specification file to validate')
  .option('-f, --format <format>', 'Output format (json|html|markdown)', 'json')
  .option('-o, --output <path>', 'Output directory for reports', './validation-reports')
  .option('--no-ai', 'Disable AI-powered validation')
  .option('--no-compliance', 'Disable compliance checking')
  .option('--standards <standards...>', 'Specific compliance standards to check')
  .option('--dry-run', 'Validate without generating reports')
  .option('--verbose', 'Enable verbose logging')
  .action(async (file: string, options) => {
    try {
      console.log(`🔍 Validating specification: ${file}`);
      
      const filePath = resolve(file);
      const content = await readFile(filePath, 'utf-8');
      const specification = JSON.parse(content);
      
      const pipeline = new SpecificationValidationPipeline();
      
      const validationOptions: ValidationOptions = {
        specificationId: file,
        includeAI: !options.noAi,
        includeCompliance: !options.noCompliance,
        format: options.format,
        outputPath: options.output,
        dryRun: options.dryRun,
      };
      
      if (options.standards) {
        validationOptions.standardIds = options.standards;
      }
      
      const result = await pipeline.validateSpecification(specification, validationOptions);
      
      // Console output
      console.log(`\n📊 Validation Results for ${result.context.specificationId}`);
      console.log(`Status: ${result.status === 'passed' ? '✅ PASSED' : result.status === 'failed' ? '❌ FAILED' : '⚠️  WARNING'}`);
      console.log(`Errors: ${result.summary.errors}`);
      console.log(`Warnings: ${result.summary.warnings}`);
      console.log(`Info: ${result.summary.info}`);
      console.log(`Execution time: ${result.metrics.executionTime}ms`);
      
      if (result.issues.length > 0) {
        console.log('\n🔍 Issues Found:');
        result.issues.forEach((issue, index) => {
          const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`${index + 1}. ${icon} [${issue.ruleId}] ${issue.message}`);
          if (issue.path) console.log(`   Path: ${issue.path}`);
          if (issue.suggestion && options.verbose) {
            console.log(`   Suggestion: ${issue.suggestion}`);
          }
        });
      }
      
      if (result.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        result.recommendations.slice(0, 5).forEach((rec, index) => {
          console.log(`${index + 1}. ${rec.title} (${rec.priority} priority)`);
          console.log(`   ${rec.description}`);
        });
      }
      
      if (result.aiInsights && options.verbose) {
        console.log('\n🤖 AI Insights:');
        result.aiInsights.slice(0, 3).forEach((insight, index) => {
          console.log(`${index + 1}. ${insight.category}: ${insight.finding} (confidence: ${Math.round(insight.confidence * 100)}%)`);
        });
      }
      
      if (result.complianceStatus && options.verbose) {
        console.log('\n⚖️ Compliance Status:');
        result.complianceStatus.forEach((compliance) => {
          const statusIcon = compliance.overallStatus === 'compliant' ? '✅' : 
                           compliance.overallStatus === 'partial' ? '⚠️' : '❌';
          console.log(`${statusIcon} ${compliance.standardName}: ${compliance.overallStatus}`);
          if (compliance.gaps.length > 0) {
            console.log(`   Gaps: ${compliance.gaps.length}`);
          }
        });
      }
      
      if (!options.dryRun) {
        console.log(`\n📄 Report generated in: ${options.output}`);
      }
      
      // Exit with appropriate code
      process.exit(result.summary.errors > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Validation failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Batch validation
program
  .command('batch')
  .description('Validate multiple specification files')
  .argument('<pattern>', 'Glob pattern for specification files (e.g., "specs/**/*.json")')
  .option('-f, --format <format>', 'Output format (json|html|markdown)', 'json')
  .option('-o, --output <path>', 'Output directory for reports', './validation-reports')
  .option('--no-ai', 'Disable AI-powered validation')
  .option('--no-compliance', 'Disable compliance checking')
  .option('--standards <standards...>', 'Specific compliance standards to check')
  .option('--no-parallel', 'Disable parallel validation')
  .option('--dry-run', 'Validate without generating reports')
  .option('--verbose', 'Enable verbose logging')
  .action(async (pattern: string, options) => {
    try {
      const { glob } = await import('glob');
      const files = await glob(pattern);
      
      if (files.length === 0) {
        console.log(`No files found matching pattern: ${pattern}`);
        process.exit(0);
      }
      
      console.log(`🔍 Validating ${files.length} specifications...`);
      
      const specifications = [];
      for (const file of files) {
        try {
          const content = await readFile(file, 'utf-8');
          const spec = JSON.parse(content);
          specifications.push({ id: file, data: spec });
        } catch (error) {
          console.warn(`⚠️ Skipping ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      const pipeline = new SpecificationValidationPipeline();
      
      const validationOptions: ValidationOptions = {
        includeAI: !options.noAi,
        includeCompliance: !options.noCompliance,
        format: options.format,
        outputPath: options.output,
        parallel: !options.noParallel,
        dryRun: options.dryRun,
      };
      
      if (options.standards) {
        validationOptions.standardIds = options.standards;
      }
      
      const results = await pipeline.validateBatch(specifications, validationOptions);
      
      // Summary output
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const warnings = results.filter(r => r.status === 'warning').length;
      
      console.log(`\n📊 Batch Validation Summary`);
      console.log(`Total: ${results.length}`);
      console.log(`✅ Passed: ${passed}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`⚠️  Warnings: ${warnings}`);
      
      if (options.verbose) {
        console.log('\n📋 Individual Results:');
        results.forEach((result) => {
          const icon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
          console.log(`${icon} ${result.context.specificationId}: ${result.summary.errors} errors, ${result.summary.warnings} warnings`);
        });
      }
      
      if (!options.dryRun) {
        console.log(`\n📄 Batch report generated in: ${options.output}`);
      }
      
      // Exit with appropriate code
      process.exit(failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Batch validation failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Configuration management
program
  .command('config')
  .description('Manage validation configuration')
  .option('--list-rules', 'List all available validation rules')
  .option('--list-standards', 'List all available compliance standards')
  .option('--enable-rule <ruleId>', 'Enable a validation rule')
  .option('--disable-rule <ruleId>', 'Disable a validation rule')
  .option('--export <file>', 'Export current configuration to file')
  .option('--import <file>', 'Import configuration from file')
  .action(async (options) => {
    try {
      const pipeline = new SpecificationValidationPipeline();
      const config = pipeline.getConfig();
      
      if (options.listRules) {
        console.log('📋 Available Validation Rules:');
        const rules = config.getConfig().rules;
        rules.forEach((rule) => {
          const status = rule.enabled ? '✅' : '❌';
          console.log(`${status} ${rule.id}: ${rule.name} (${rule.category}, ${rule.severity})`);
          console.log(`   ${rule.description}`);
        });
      }
      
      if (options.listStandards) {
        console.log('⚖️ Available Compliance Standards:');
        const standards = config.getConfig().compliance;
        standards.forEach((standard) => {
          console.log(`• ${standard.id}: ${standard.name} v${standard.version || 'latest'}`);
          console.log(`   ${standard.description}`);
          console.log(`   Applicable to: ${standard.applicableCategories.join(', ')}`);
        });
      }
      
      if (options.enableRule) {
        const success = config.toggleRule(options.enableRule, true);
        if (success) {
          console.log(`✅ Enabled rule: ${options.enableRule}`);
        } else {
          console.log(`❌ Rule not found: ${options.enableRule}`);
        }
      }
      
      if (options.disableRule) {
        const success = config.toggleRule(options.disableRule, false);
        if (success) {
          console.log(`❌ Disabled rule: ${options.disableRule}`);
        } else {
          console.log(`❌ Rule not found: ${options.disableRule}`);
        }
      }
      
      if (options.export) {
        const { writeFile } = await import('fs/promises');
        const configData = JSON.stringify(config.getConfig(), null, 2);
        await writeFile(options.export, configData, 'utf-8');
        console.log(`📤 Configuration exported to: ${options.export}`);
      }
      
      if (options.import) {
        const configData = await readFile(options.import, 'utf-8');
        const configObj = JSON.parse(configData);
        config.loadFromObject(configObj);
        console.log(`📥 Configuration imported from: ${options.import}`);
      }
      
    } catch (error) {
      console.error('❌ Configuration operation failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Sample specification generation
program
  .command('sample')
  .description('Generate a sample specification file')
  .option('-o, --output <file>', 'Output file path', './sample-specification.json')
  .option('--category <category>', 'Specification category', 'api')
  .action(async (options) => {
    try {
      const sampleSpec = {
        metadata: {
          id: 'sample-spec-001',
          name: 'Sample API Specification',
          version: '1.0.0',
          description: 'A sample API specification demonstrating the validation system capabilities',
          author: {
            name: 'API Team',
            email: 'api-team@example.com',
            organization: 'Sample Corp'
          },
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          tags: ['api', 'sample', 'validation'],
          category: options.category,
          status: 'draft',
          priority: 'medium'
        },
        summary: {
          purpose: 'This sample specification demonstrates proper structure and validation requirements',
          scope: 'Covers basic API functionality including authentication and data operations',
          stakeholders: [
            {
              role: 'Product Manager',
              name: 'Jane Doe',
              responsibilities: ['Requirements definition', 'Business validation']
            }
          ],
          assumptions: ['Users have valid accounts', 'System supports HTTPS'],
          constraints: ['Must comply with data protection regulations']
        },
        requirements: [
          {
            id: 'REQ-001',
            title: 'User Authentication',
            description: 'System must authenticate users with secure credentials and session management',
            type: 'security',
            priority: 'must-have',
            rationale: 'Authentication is required for secure access to system resources',
            acceptanceCriteria: [
              {
                id: 'AC-001-1',
                description: 'Users can login with valid credentials',
                testable: true
              }
            ],
            dependencies: [],
            risks: []
          }
        ]
      };
      
      const { writeFile } = await import('fs/promises');
      await writeFile(options.output, JSON.stringify(sampleSpec, null, 2), 'utf-8');
      console.log(`✅ Sample specification generated: ${options.output}`);
      console.log('💡 Tip: Validate it with: npx spec-validate validate ' + options.output);
      
    } catch (error) {
      console.error('❌ Sample generation failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Start the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { program };