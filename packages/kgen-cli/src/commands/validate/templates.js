#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname, relative } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

/**
 * Template validation engine
 */
class TemplateValidator {
  constructor() {
    this.supportedEngines = {
      'handlebars': {
        extensions: ['.hbs', '.handlebars'],
        validator: this.validateHandlebars.bind(this)
      },
      'mustache': {
        extensions: ['.mustache', '.mu'],
        validator: this.validateMustache.bind(this)
      },
      'nunjucks': {
        extensions: ['.njk', '.nunjucks'],
        validator: this.validateNunjucks.bind(this)
      }
    };
  }

  /**
   * Validate Handlebars template syntax
   * @param {string} content - Template content
   * @param {string} filePath - Template file path
   * @returns {Object} Validation result
   */
  validateHandlebars(content, filePath) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      helpers: new Set(),
      partials: new Set(),
      variables: new Set()
    };

    try {
      // Extract Handlebars expressions
      const expressions = content.match(/\{\{[^}]*\}\}/g) || [];
      const blockExpressions = content.match(/\{\{#[^}]*\}\}/g) || [];
      
      // Validate expression syntax
      expressions.forEach(expr => {
        try {
          // Remove outer braces and trim
          const inner = expr.slice(2, -2).trim();
          
          // Check for malformed expressions
          if (inner === '') {
            result.warnings.push('Empty Handlebars expression found');
            return;
          }

          // Extract helpers and variables
          const parts = inner.split(/\s+/);
          if (parts[0] && !parts[0].startsWith('.') && !parts[0].startsWith('@')) {
            if (parts.length > 1 || inner.includes('(')) {
              result.helpers.add(parts[0]);
            } else {
              result.variables.add(parts[0]);
            }
          }

          // Check for common syntax errors
          if (inner.includes('{{') || inner.includes('}}')) {
            result.errors.push(`Nested braces not allowed in expression: ${expr}`);
          }

          // Check for unclosed quotes
          const quotes = (inner.match(/"/g) || []).length + (inner.match(/'/g) || []).length;
          if (quotes % 2 !== 0) {
            result.warnings.push(`Unclosed quote in expression: ${expr}`);
          }

        } catch (error) {
          result.errors.push(`Invalid expression syntax: ${expr}`);
        }
      });

      // Validate block expressions
      const openBlocks = new Map();
      const allBlocks = content.match(/\{\{[#/][^}]*\}\}/g) || [];
      
      allBlocks.forEach(block => {
        const inner = block.slice(2, -2).trim();
        if (inner.startsWith('#')) {
          // Opening block
          const blockName = inner.substring(1).split(/\s+/)[0];
          if (!openBlocks.has(blockName)) {
            openBlocks.set(blockName, []);
          }
          openBlocks.get(blockName).push(block);
        } else if (inner.startsWith('/')) {
          // Closing block
          const blockName = inner.substring(1);
          if (openBlocks.has(blockName) && openBlocks.get(blockName).length > 0) {
            openBlocks.get(blockName).pop();
          } else {
            result.errors.push(`Unmatched closing block: ${block}`);
          }
        }
      });

      // Check for unclosed blocks
      openBlocks.forEach((blocks, blockName) => {
        if (blocks.length > 0) {
          result.errors.push(`Unclosed block helper: ${blockName} (${blocks.length} unclosed)`);
        }
      });

      // Extract partials
      const partialMatches = content.match(/\{\{>\s*([^}]+)\}\}/g) || [];
      partialMatches.forEach(match => {
        const partialName = match.match(/\{\{>\s*([^}\s]+)/)[1];
        result.partials.add(partialName);
      });

    } catch (error) {
      result.valid = false;
      result.errors.push(`Template parsing error: ${error.message}`);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate Mustache template syntax
   * @param {string} content - Template content
   * @param {string} filePath - Template file path
   * @returns {Object} Validation result
   */
  validateMustache(content, filePath) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      variables: new Set(),
      partials: new Set(),
      sections: new Set()
    };

    try {
      // Mustache tag pattern: {{tag}}
      const tags = content.match(/\{\{[^}]*\}\}/g) || [];
      const openSections = [];

      tags.forEach(tag => {
        const inner = tag.slice(2, -2).trim();
        
        if (inner === '') {
          result.warnings.push('Empty Mustache tag found');
          return;
        }

        // Section tags
        if (inner.startsWith('#')) {
          const sectionName = inner.substring(1);
          result.sections.add(sectionName);
          openSections.push(sectionName);
        } else if (inner.startsWith('/')) {
          const closingSection = inner.substring(1);
          const lastOpen = openSections.pop();
          if (lastOpen !== closingSection) {
            result.errors.push(`Mismatched section closing: expected {{/${lastOpen}}}, got {{/${closingSection}}}`);
          }
        } else if (inner.startsWith('>')) {
          // Partial
          const partialName = inner.substring(1).trim();
          result.partials.add(partialName);
        } else if (inner.startsWith('&') || inner.startsWith('{')) {
          // Unescaped variable
          const varName = inner.substring(1).replace(/}$/, '').trim();
          result.variables.add(varName);
        } else if (inner.startsWith('!')) {
          // Comment - ignore
        } else {
          // Regular variable
          result.variables.add(inner);
        }

        // Check for invalid characters
        if (inner.includes('{{') || inner.includes('}}')) {
          result.errors.push(`Nested braces not allowed in Mustache: ${tag}`);
        }
      });

      // Check for unclosed sections
      if (openSections.length > 0) {
        result.errors.push(`Unclosed sections: ${openSections.join(', ')}`);
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Template parsing error: ${error.message}`);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate Nunjucks template syntax
   * @param {string} content - Template content
   * @param {string} filePath - Template file path
   * @returns {Object} Validation result
   */
  validateNunjucks(content, filePath) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      variables: new Set(),
      filters: new Set(),
      macros: new Set(),
      includes: new Set()
    };

    try {
      // Variable expressions: {{ variable }}
      const variableMatches = content.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
      variableMatches.forEach(match => {
        const inner = match.slice(2, -2).trim();
        
        // Extract variable name and filters
        if (inner.includes('|')) {
          const parts = inner.split('|');
          result.variables.add(parts[0].trim());
          parts.slice(1).forEach(filter => {
            const filterName = filter.trim().split('(')[0];
            result.filters.add(filterName);
          });
        } else {
          result.variables.add(inner.split('.')[0].split('[')[0]);
        }
      });

      // Block expressions: {% block %}
      const blockMatches = content.match(/\{%[^%]*%\}/g) || [];
      const openBlocks = [];

      blockMatches.forEach(block => {
        const inner = block.slice(2, -2).trim();
        const parts = inner.split(/\s+/);
        const command = parts[0];

        switch (command) {
          case 'for':
          case 'if':
          case 'block':
          case 'macro':
            openBlocks.push(command);
            if (command === 'macro' && parts[1]) {
              result.macros.add(parts[1]);
            }
            break;
          case 'endfor':
          case 'endif':
          case 'endblock':
          case 'endmacro':
            const expected = command.substring(3);
            const last = openBlocks.pop();
            if (last !== expected) {
              result.errors.push(`Mismatched block: expected end${last}, got ${command}`);
            }
            break;
          case 'include':
          case 'import':
            if (parts[1]) {
              result.includes.add(parts[1].replace(/['"]/g, ''));
            }
            break;
        }
      });

      // Check for unclosed blocks
      if (openBlocks.length > 0) {
        result.errors.push(`Unclosed blocks: ${openBlocks.join(', ')}`);
      }

      // Check for syntax errors
      const invalidExpressions = content.match(/\{\{[^}]*\{\{|\}\}[^{]*\}\}/g);
      if (invalidExpressions) {
        result.errors.push('Invalid nested expressions found');
      }

      const invalidBlocks = content.match(/\{%[^%]*\{%|\}%[^{]*%\}/g);
      if (invalidBlocks) {
        result.errors.push('Invalid nested block statements found');
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Template parsing error: ${error.message}`);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Detect template engine from file extension or content
   * @param {string} filePath - Template file path
   * @param {string} content - Template content
   * @returns {string|null} Detected engine name
   */
  detectEngine(filePath, content) {
    const ext = extname(filePath).toLowerCase();
    
    // Check by extension first
    for (const [engine, config] of Object.entries(this.supportedEngines)) {
      if (config.extensions.includes(ext)) {
        return engine;
      }
    }

    // Check by content patterns
    if (content.includes('{{#') || content.includes('{{>')) {
      return 'handlebars';
    }
    if (content.includes('{{#') && !content.includes('{{>')) {
      return 'mustache';
    }
    if (content.includes('{%') || content.includes('{{') && content.includes('|')) {
      return 'nunjucks';
    }

    return null;
  }

  /**
   * Validate template directory structure
   * @param {string} templatesDir - Templates directory path
   * @returns {Object} Directory validation result
   */
  validateDirectory(templatesDir) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      templates: [],
      partials: [],
      helpers: []
    };

    if (!existsSync(templatesDir)) {
      result.valid = false;
      result.errors.push(`Templates directory not found: ${templatesDir}`);
      return result;
    }

    if (!statSync(templatesDir).isDirectory()) {
      result.valid = false;
      result.errors.push(`Templates path is not a directory: ${templatesDir}`);
      return result;
    }

    // Scan directory for templates
    try {
      const files = readdirSync(templatesDir, { recursive: true });
      
      files.forEach(file => {
        if (typeof file === 'string') {
          const fullPath = join(templatesDir, file);
          const stat = statSync(fullPath);
          
          if (stat.isFile()) {
            const ext = extname(file).toLowerCase();
            const isTemplate = Object.values(this.supportedEngines)
              .some(config => config.extensions.includes(ext));
              
            if (isTemplate) {
              if (file.includes('partial') || file.startsWith('_')) {
                result.partials.push(file);
              } else {
                result.templates.push(file);
              }
            } else if (ext === '.js') {
              result.helpers.push(file);
            }
          }
        }
      });

      if (result.templates.length === 0) {
        result.warnings.push('No template files found in directory');
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Error scanning templates directory: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate cross-references between templates
   * @param {Object} templateResults - Map of template validation results
   * @returns {Object} Cross-reference validation result
   */
  validateCrossReferences(templateResults) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    const availablePartials = new Set();
    const availableHelpers = new Set();
    const availableMacros = new Set();

    // Collect available resources
    Object.values(templateResults).forEach(templateResult => {
      if (templateResult.partials) {
        templateResult.partials.forEach(partial => availablePartials.add(partial));
      }
      if (templateResult.helpers) {
        templateResult.helpers.forEach(helper => availableHelpers.add(helper));
      }
      if (templateResult.macros) {
        templateResult.macros.forEach(macro => availableMacros.add(macro));
      }
    });

    // Check references
    Object.entries(templateResults).forEach(([templatePath, templateResult]) => {
      // Check partial references
      if (templateResult.partials) {
        templateResult.partials.forEach(partial => {
          if (!availablePartials.has(partial)) {
            result.warnings.push(`Referenced partial '${partial}' not found in templates directory (${templatePath})`);
          }
        });
      }

      // Check helper references
      if (templateResult.helpers) {
        templateResult.helpers.forEach(helper => {
          // Skip built-in helpers
          const builtInHelpers = ['each', 'if', 'unless', 'with', 'lookup', 'log'];
          if (!builtInHelpers.includes(helper) && !availableHelpers.has(helper)) {
            result.warnings.push(`Referenced helper '${helper}' not found (${templatePath})`);
          }
        });
      }
    });

    return result;
  }
}

/**
 * Create validate templates command
 * @returns {Command} The configured validate templates command
 */
export function createValidateTemplatesCommand() {
  return new Command('templates')
    .description('Validate template syntax, structure, and cross-references')
    .argument('[directory]', 'Templates directory to validate', 'templates')
    .option('-e, --engine <engine>', 'Template engine (handlebars, mustache, nunjucks)')
    .option('-r, --recursive', 'Recursively validate all templates in directory', true)
    .option('-x, --cross-refs', 'Validate cross-references between templates', true)
    .option('--json', 'Output results in JSON format')
    .option('-v, --verbose', 'Show detailed validation information')
    .option('--exit-code', 'Exit with non-zero code if validation fails')
    .action(async (directory, options) => {
      try {
        console.log(chalk.blue('📝 Template Validation'));
        console.log(chalk.blue('━'.repeat(30)));

        const validator = new TemplateValidator();
        const templatesDir = resolve(directory);

        // Validate directory structure
        console.log(chalk.blue(`📁 Validating directory: ${directory}`));
        const dirResult = validator.validateDirectory(templatesDir);

        if (!dirResult.valid) {
          console.error(chalk.red('Directory validation failed:'));
          dirResult.errors.forEach(error => console.error(chalk.red(`  ✗ ${error}`)));
          if (options.exitCode) process.exit(1);
          return;
        }

        console.log(chalk.green('  ✓ Directory structure valid'));
        console.log(chalk.gray(`    Templates: ${dirResult.templates.length}`));
        console.log(chalk.gray(`    Partials: ${dirResult.partials.length}`));
        console.log(chalk.gray(`    Helpers: ${dirResult.helpers.length}`));

        // Find template files
        const patterns = options.engine ? 
          validator.supportedEngines[options.engine].extensions.map(ext => `**/*${ext}`) :
          ['**/*.hbs', '**/*.handlebars', '**/*.mustache', '**/*.mu', '**/*.njk', '**/*.nunjucks'];

        let templateFiles = [];
        for (const pattern of patterns) {
          const files = await glob(pattern, { 
            cwd: templatesDir,
            ignore: ['node_modules/**'] 
          });
          templateFiles.push(...files.map(f => join(templatesDir, f)));
        }

        if (templateFiles.length === 0) {
          console.log(chalk.yellow('⚠️  No template files found'));
          return;
        }

        console.log(chalk.blue(`\n🔍 Validating ${templateFiles.length} templates:`));
        console.log(chalk.blue('━'.repeat(35)));

        // Validate each template
        const results = {
          valid: true,
          templates: {},
          summary: {
            total: templateFiles.length,
            valid: 0,
            errors: 0,
            warnings: 0
          }
        };

        for (const templateFile of templateFiles) {
          const relativePath = relative(templatesDir, templateFile);
          console.log(chalk.blue(`  🔍 ${relativePath}`));

          try {
            const content = readFileSync(templateFile, 'utf8');
            const engine = options.engine || validator.detectEngine(templateFile, content);

            if (!engine) {
              console.log(chalk.yellow('    ⚠ Could not detect template engine'));
              results.summary.warnings++;
              continue;
            }

            const templateResult = validator.supportedEngines[engine].validator(content, templateFile);
            results.templates[templateFile] = templateResult;

            if (templateResult.valid) {
              results.summary.valid++;
              console.log(chalk.green(`    ✓ Valid ${engine} template`));
              
              if (options.verbose) {
                if (templateResult.variables?.size > 0) {
                  console.log(chalk.gray(`      Variables: ${Array.from(templateResult.variables).join(', ')}`));
                }
                if (templateResult.helpers?.size > 0) {
                  console.log(chalk.gray(`      Helpers: ${Array.from(templateResult.helpers).join(', ')}`));
                }
                if (templateResult.partials?.size > 0) {
                  console.log(chalk.gray(`      Partials: ${Array.from(templateResult.partials).join(', ')}`));
                }
              }
            } else {
              results.valid = false;
              results.summary.errors++;
              console.log(chalk.red(`    ✗ Template has errors`));
              
              templateResult.errors.forEach(error => {
                console.log(chalk.red(`      ${error}`));
              });
            }

            // Show warnings
            if (templateResult.warnings?.length > 0) {
              templateResult.warnings.forEach(warning => {
                console.log(chalk.yellow(`      ⚠ ${warning}`));
                results.summary.warnings++;
              });
            }

          } catch (error) {
            results.valid = false;
            results.summary.errors++;
            console.log(chalk.red(`    ✗ Failed to validate: ${error.message}`));
          }
        }

        // Cross-reference validation
        if (options.crossRefs && Object.keys(results.templates).length > 0) {
          console.log(chalk.blue('\n🔗 Validating cross-references:'));
          console.log(chalk.blue('━'.repeat(30)));
          
          const crossRefResult = validator.validateCrossReferences(results.templates);
          
          if (crossRefResult.errors.length === 0 && crossRefResult.warnings.length === 0) {
            console.log(chalk.green('  ✓ All cross-references valid'));
          } else {
            crossRefResult.errors.forEach(error => {
              console.log(chalk.red(`  ✗ ${error}`));
              results.summary.errors++;
            });
            
            crossRefResult.warnings.forEach(warning => {
              console.log(chalk.yellow(`  ⚠ ${warning}`));
              results.summary.warnings++;
            });
          }
        }

        // Display summary
        console.log(chalk.blue('\n📊 Validation Summary'));
        console.log(chalk.blue('━'.repeat(25)));
        console.log(`Total templates: ${results.summary.total}`);
        console.log(`Valid: ${chalk.green(results.summary.valid)}`);
        console.log(`Errors: ${chalk.red(results.summary.errors)}`);
        console.log(`Warnings: ${chalk.yellow(results.summary.warnings)}`);

        if (results.valid) {
          console.log(chalk.green('\n🎉 All templates are valid'));
        } else {
          console.log(chalk.red('\n❌ Some templates have errors'));
        }

        // JSON output
        if (options.json) {
          console.log(chalk.blue('\n📄 JSON Results:'));
          console.log(JSON.stringify({
            valid: results.valid,
            summary: results.summary,
            directory: templatesDir,
            templates: Object.keys(results.templates).map(path => ({
              path: relative(templatesDir, path),
              valid: results.templates[path].valid,
              errors: results.templates[path].errors.length,
              warnings: results.templates[path].warnings.length
            })),
            timestamp: this.getDeterministicDate().toISOString()
          }, null, 2));
        }

        if (options.exitCode && !results.valid) {
          process.exit(1);
        }

      } catch (error) {
        console.error(chalk.red('Template validation failed:'), error.message);
        if (options.exitCode) {
          process.exit(1);
        }
      }
    });
}