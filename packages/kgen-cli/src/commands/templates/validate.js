/**
 * Template Frontmatter Validation Command
 * 
 * Validate template frontmatter against schemas and check for common issues.
 */

import { defineCommand } from 'citty';
import { existsSync, readFileSync } from 'fs';
import { resolve, extname, basename } from 'path';

import { success, error, output } from '../../lib/output.js';
import { loadKgenConfig, findFiles } from '../../lib/utils.js';
import { FrontmatterWorkflowEngine, SchemaValidator } from '../../../../../src/kgen/core/frontmatter/index.js';

export default defineCommand({
  meta: {
    name: 'validate',
    description: 'Validate template frontmatter against schemas'
  },
  args: {
    name: {
      type: 'string',
      description: 'Template name to validate (optional, validates all if omitted)',
      alias: 'n'
    },
    schema: {
      type: 'string',
      description: 'Schema name to validate against',
      default: 'kgen',
      alias: 's'
    },
    pattern: {
      type: 'string',
      description: 'Glob pattern for templates to validate',
      default: '**/*',
      alias: 'p'
    },
    strict: {
      type: 'boolean',
      description: 'Enable strict validation mode',
      default: false
    },
    failFast: {
      type: 'boolean',
      description: 'Stop on first validation error',
      default: false,
      alias: 'ff'
    },
    showValid: {
      type: 'boolean',
      description: 'Show valid templates in output',
      default: false,
      alias: 'v'
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml|table)',
      default: 'json',
      alias: 'f'
    }
  },
  async run({ args }) {
    let config;
    let workflowEngine;
    
    try {
      const startTime = this.getDeterministicTimestamp();
      
      // Load configuration
      config = await loadKgenConfig(args.config);
      
      // Get templates directory
      const templatesDir = resolve(config.directories.templates);
      
      if (!existsSync(templatesDir)) {
        throw new Error(`Templates directory not found: ${templatesDir}`);
      }
      
      // Find template files to validate
      let templateFiles = [];
      
      if (args.name) {
        // Validate specific template
        const patterns = ['**/*.njk', '**/*.j2', '**/*.ejs'];
        const allFiles = findFiles(patterns, {
          cwd: templatesDir,
          absolute: true
        });
        
        templateFiles = allFiles.filter(file => {
          const name = basename(file, extname(file));
          return name === args.name || file.includes(args.name);
        });
        
        if (templateFiles.length === 0) {
          throw new Error(`Template not found: ${args.name}`);
        }
      } else {
        // Validate all matching templates
        const patterns = args.pattern.includes('*') 
          ? [args.pattern] 
          : [`**/${args.pattern}*`, `**/*${args.pattern}*`];
          
        templateFiles = findFiles(patterns.flatMap(p => [
          `${p}.njk`, `${p}.j2`, `${p}.ejs`
        ]), {
          cwd: templatesDir,
          absolute: true
        });
      }
      
      if (templateFiles.length === 0) {
        throw new Error('No templates found matching criteria');
      }
      
      // Initialize workflow engine
      workflowEngine = new FrontmatterWorkflowEngine({
        enableValidation: true,
        enableSchemaValidation: true,
        enableProvenance: false,
        deterministic: true
      });
      
      await workflowEngine.initialize();
      
      // Validate each template
      const results = [];
      let validCount = 0;
      let invalidCount = 0;
      let errorCount = 0;
      
      for (const templatePath of templateFiles) {
        try {
          const content = readFileSync(templatePath, 'utf8');
          const templateName = basename(templatePath, extname(templatePath));
          
          // Check if template has frontmatter
          if (!content.includes('---')) {
            if (args.showValid) {
              results.push({
                template: templateName,
                path: templatePath,
                status: 'no_frontmatter',
                message: 'Template has no frontmatter to validate',
                valid: true,
                errors: [],
                warnings: []
              });
            }
            validCount++;
            continue;
          }
          
          // Validate frontmatter
          const validation = await workflowEngine.validateTemplate(content, args.schema);
          
          const result = {
            template: templateName,
            path: templatePath,
            status: validation.valid ? 'valid' : 'invalid',
            valid: validation.valid,
            errors: validation.errors || [],
            warnings: validation.warnings || [],
            schema: args.schema
          };
          
          if (validation.valid) {
            validCount++;
            if (args.showValid) {
              results.push(result);
            }
          } else {
            invalidCount++;
            results.push(result);
            
            if (args.failFast) {
              break;
            }
          }
          
        } catch (templateError) {
          errorCount++;
          const templateName = basename(templatePath, extname(templatePath));
          
          results.push({
            template: templateName,
            path: templatePath,
            status: 'error',
            valid: false,
            errors: [{
              code: 'PROCESSING_ERROR',
              message: templateError.message,
              severity: 'error'
            }],
            warnings: []
          });
          
          if (args.failFast) {
            break;
          }
        }
      }
      
      const duration = this.getDeterministicTimestamp() - startTime;
      
      // Determine overall status
      const overallValid = invalidCount === 0 && errorCount === 0;
      
      const result = success({
        validation: {
          schema: args.schema,
          strict: args.strict,
          overallValid,
          summary: {
            total: templateFiles.length,
            valid: validCount,
            invalid: invalidCount,
            errors: errorCount,
            processed: results.length
          }
        },
        results: results,
        metrics: {
          durationMs: duration,
          templatesDir,
          pattern: args.pattern
        }
      });
      
      // If using table format, format the output differently
      if (args.format === 'table') {
        console.log('\
📋 Template Frontmatter Validation Results\
');
        console.log(`Schema: ${args.schema} | Total: ${templateFiles.length} | Valid: ${validCount} | Invalid: ${invalidCount} | Errors: ${errorCount}\
`);
        
        if (results.length > 0) {
          console.log('Template'.padEnd(30) + 'Status'.padEnd(12) + 'Issues');
          console.log('-'.repeat(70));
          
          results.forEach(r => {
            const status = r.valid ? '✅ Valid' : (r.status === 'error' ? '❌ Error' : '⚠️  Invalid');
            const issues = r.errors.length > 0 
              ? `${r.errors.length} errors${r.warnings.length > 0 ? `, ${r.warnings.length} warnings` : ''}`
              : r.warnings.length > 0 
                ? `${r.warnings.length} warnings`
                : 'None';
                
            console.log(r.template.padEnd(30) + status.padEnd(12) + issues);
            
            // Show first few errors/warnings
            if (r.errors.length > 0) {
              r.errors.slice(0, 2).forEach(err => {
                console.log(`  ❌ ${err.message}`);
              });
            }
            if (r.warnings.length > 0) {
              r.warnings.slice(0, 2).forEach(warn => {
                console.log(`  ⚠️  ${warn.message}`);
              });
            }
          });
        }
        
        console.log(`\
⏱️  Completed in ${duration}ms`);
        
        // Exit with error code if validation failed
        if (!overallValid) {
          process.exit(1);
        }
      } else {
        output(result, args.format);
        
        // Exit with error code if validation failed
        if (!overallValid) {
          process.exit(1);
        }
      }
      
    } catch (err) {
      const result = error(err.message, 'TEMPLATE_VALIDATION_FAILED', {
        name: args.name,
        schema: args.schema,
        templatesDir: config?.directories?.templates,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    } finally {
      if (workflowEngine) {
        try {
          await workflowEngine.shutdown();
        } catch (shutdownError) {
          // Ignore shutdown errors
        }
      }
    }
  }
});