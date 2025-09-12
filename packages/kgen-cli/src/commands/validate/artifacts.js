#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve, extname, basename } from 'path';
import { Parser } from 'n3';
import chalk from 'chalk';
import Ajv from 'ajv';
// import addFormats from 'ajv-formats'; // Temporarily disabled
const addFormats = () => {}; // Stub function

/**
 * Validation result structure
 */
class ValidationResult {
  constructor() {
    this.success = true;
    this.errors = [];
    this.warnings = [];
    this.validatedFiles = [];
    this.skippedFiles = [];
    this.timestamp = new Date().toISOString();
  }

  addError(file, message, context = null) {
    this.success = false;
    this.errors.push({ file, message, context, type: 'error' });
  }

  addWarning(file, message, context = null) {
    this.warnings.push({ file, message, context, type: 'warning' });
  }

  addValidated(file, format, triples = null) {
    this.validatedFiles.push({ file, format, triples, status: 'valid' });
  }

  addSkipped(file, reason) {
    this.skippedFiles.push({ file, reason });
  }
}

/**
 * Validate RDF/Turtle syntax
 * @param {string} filePath - Path to RDF file
 * @param {string} content - File content
 * @returns {Object} Validation result
 */
function validateRDFSyntax(filePath, content) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    triples: 0,
    prefixes: new Set()
  };

  try {
    const parser = new Parser({ 
      baseIRI: `file://${filePath}`,
      format: 'text/turtle'
    });

    const quads = parser.parse(content);
    result.triples = quads.length;

    // Extract prefixes
    const prefixMatches = content.match(/@prefix\s+(\w+):/g);
    if (prefixMatches) {
      prefixMatches.forEach(match => {
        const prefix = match.match(/@prefix\s+(\w+):/)[1];
        result.prefixes.add(prefix);
      });
    }

    // Check for common issues
    if (quads.length === 0) {
      result.warnings.push('File contains no triples');
    }

    // Check for malformed URIs
    const uriPattern = /<[^>]*>/g;
    const uris = content.match(uriPattern);
    if (uris) {
      uris.forEach(uri => {
        const cleaned = uri.slice(1, -1);
        try {
          new URL(cleaned);
        } catch (e) {
          if (!cleaned.startsWith('_:')) { // Ignore blank nodes
            result.warnings.push(`Potentially malformed URI: ${uri}`);
          }
        }
      });
    }

  } catch (error) {
    result.valid = false;
    result.errors.push({
      message: error.message,
      line: error.line || null,
      column: error.column || null
    });
  }

  return result;
}

/**
 * Validate N3/Notation3 syntax
 * @param {string} filePath - Path to N3 file  
 * @param {string} content - File content
 * @returns {Object} Validation result
 */
function validateN3Syntax(filePath, content) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    rules: 0,
    implications: 0
  };

  try {
    const parser = new Parser({ 
      baseIRI: `file://${filePath}`,
      format: 'text/n3'
    });

    const quads = parser.parse(content);
    
    // Count rules and implications
    result.implications = (content.match(/=>/g) || []).length;
    result.rules = (content.match(/\{[^}]*\}/g) || []).length;

    if (quads.length === 0 && result.rules === 0) {
      result.warnings.push('File contains no triples or rules');
    }

  } catch (error) {
    result.valid = false;
    result.errors.push({
      message: error.message,
      line: error.line || null,
      column: error.column || null
    });
  }

  return result;
}

/**
 * Validate JSON-LD syntax and structure
 * @param {string} filePath - Path to JSON-LD file
 * @param {string} content - File content  
 * @returns {Object} Validation result
 */
function validateJSONLD(filePath, content) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    contexts: [],
    subjects: 0
  };

  try {
    const data = JSON.parse(content);
    
    // Check for @context
    if (data['@context']) {
      if (Array.isArray(data['@context'])) {
        result.contexts = data['@context'];
      } else {
        result.contexts = [data['@context']];
      }
    } else {
      result.warnings.push('No @context found - may not be valid JSON-LD');
    }

    // Count subjects
    if (Array.isArray(data)) {
      result.subjects = data.length;
    } else if (data['@id'] || data['@type']) {
      result.subjects = 1;
    }

    // Check for common JSON-LD patterns
    const jsonStr = JSON.stringify(data);
    if (!jsonStr.includes('@') && !jsonStr.includes('http')) {
      result.warnings.push('No JSON-LD keywords or URIs found - may not be semantic data');
    }

  } catch (error) {
    result.valid = false;
    result.errors.push({
      message: `JSON parsing error: ${error.message}`,
      line: null,
      column: null
    });
  }

  return result;
}

/**
 * Validate semantic constraints and business rules
 * @param {string} filePath - Path to file
 * @param {string} content - File content
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateSemanticConstraints(filePath, content, options) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    constraints: {
      requiredClasses: [],
      requiredProperties: [],
      dataIntegrity: []
    }
  };

  // Check for required semantic patterns
  if (options.requireClasses) {
    options.requireClasses.forEach(className => {
      const pattern = new RegExp(`a\\s+${className}|rdf:type\\s+${className}`, 'i');
      if (!pattern.test(content)) {
        result.warnings.push(`Expected class '${className}' not found`);
      } else {
        result.constraints.requiredClasses.push(className);
      }
    });
  }

  if (options.requireProperties) {
    options.requireProperties.forEach(property => {
      const pattern = new RegExp(`${property}\\s+`, 'i');
      if (!pattern.test(content)) {
        result.warnings.push(`Expected property '${property}' not found`);
      } else {
        result.constraints.requiredProperties.push(property);
      }
    });
  }

  // Check data integrity patterns
  const patterns = {
    hasTimestamp: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    hasEmail: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    hasURL: /https?:\/\/[^\s<>"]+/,
    hasUUID: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  };

  Object.entries(patterns).forEach(([name, pattern]) => {
    if (pattern.test(content)) {
      result.constraints.dataIntegrity.push(name);
    }
  });

  return result;
}

/**
 * Validate a single artifact file
 * @param {string} filePath - Path to artifact
 * @param {Object} options - Validation options
 * @returns {Object} Validation result for file
 */
function validateArtifact(filePath, options) {
  if (!existsSync(filePath)) {
    return {
      valid: false,
      errors: [{ message: 'File not found', line: null, column: null }],
      warnings: [],
      skipped: true
    };
  }

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: `Cannot read file: ${error.message}`, line: null, column: null }],
      warnings: [],
      skipped: true
    };
  }

  const ext = extname(filePath).toLowerCase();
  let syntaxResult;

  // Validate syntax based on file extension
  switch (ext) {
    case '.ttl':
    case '.turtle':
      syntaxResult = validateRDFSyntax(filePath, content);
      break;
    case '.n3':
      syntaxResult = validateN3Syntax(filePath, content);
      break;
    case '.jsonld':
      syntaxResult = validateJSONLD(filePath, content);
      break;
    case '.rdf':
      // Assume RDF/XML, but try Turtle parser first
      syntaxResult = validateRDFSyntax(filePath, content);
      break;
    default:
      return {
        valid: false,
        errors: [{ message: `Unsupported file format: ${ext}`, line: null, column: null }],
        warnings: [],
        skipped: true
      };
  }

  // Add semantic validation if requested
  if (options.semantic && syntaxResult.valid) {
    const semanticResult = validateSemanticConstraints(filePath, content, options);
    syntaxResult.errors.push(...semanticResult.errors);
    syntaxResult.warnings.push(...semanticResult.warnings);
    syntaxResult.constraints = semanticResult.constraints;
    syntaxResult.valid = syntaxResult.valid && semanticResult.valid;
  }

  return syntaxResult;
}

/**
 * Create validate artifacts command
 * @returns {Command} The configured validate artifacts command
 */
export function createValidateArtifactsCommand() {
  return new Command('artifacts')
    .description('Validate generated artifacts for syntax, semantics, and compliance')
    .argument('[files...]', 'Artifact files to validate')
    .option('-r, --recursive', 'Recursively validate all artifacts in directory')
    .option('-f, --format <format>', 'Expected format (ttl, n3, jsonld, rdf)', 'auto')
    .option('-s, --semantic', 'Enable semantic constraint validation')
    .option('--require-classes <classes...>', 'Required RDF classes that must be present')
    .option('--require-properties <properties...>', 'Required properties that must be present') 
    .option('--strict', 'Treat warnings as errors')
    .option('--json', 'Output results in JSON format')
    .option('-v, --verbose', 'Show detailed validation information')
    .option('--exit-code', 'Exit with non-zero code if validation fails')
    .action(async (files, options) => {
      const result = new ValidationResult();

      try {
        let filesToValidate = files || [];

        // If no files specified, try to find artifacts
        if (filesToValidate.length === 0) {
          const { glob } = await import('glob');
          filesToValidate = await glob('**/*.{ttl,n3,jsonld,rdf}', {
            ignore: ['node_modules/**', '.git/**']
          });
        }

        if (filesToValidate.length === 0) {
          result.addError('', 'No artifact files found to validate');
        }

        // Validate each file
        for (const file of filesToValidate) {
          const filePath = resolve(file);
          const fileName = basename(file);

          console.log(chalk.blue(`🔍 Validating: ${fileName}`));

          const fileResult = validateArtifact(filePath, options);

          if (fileResult.skipped) {
            result.addSkipped(file, fileResult.errors[0]?.message || 'Unknown reason');
            continue;
          }

          if (fileResult.valid) {
            result.addValidated(file, extname(file), fileResult.triples);
            console.log(chalk.green(`  ✓ Valid ${extname(file)} file`));
            
            if (fileResult.triples) {
              console.log(chalk.gray(`    ${fileResult.triples} triples`));
            }
            if (fileResult.rules) {
              console.log(chalk.gray(`    ${fileResult.rules} rules`));
            }
          } else {
            fileResult.errors.forEach(error => {
              result.addError(file, error.message, error);
              console.log(chalk.red(`  ✗ ${error.message}`));
              if (error.line) {
                console.log(chalk.gray(`    Line ${error.line}${error.column ? `, Column ${error.column}` : ''}`));
              }
            });
          }

          // Handle warnings
          fileResult.warnings?.forEach(warning => {
            if (options.strict) {
              result.addError(file, warning);
              console.log(chalk.red(`  ✗ ${warning} (strict mode)`));
            } else {
              result.addWarning(file, warning);
              console.log(chalk.yellow(`  ⚠ ${warning}`));
            }
          });

          if (options.verbose && fileResult.constraints) {
            console.log(chalk.blue('    Semantic validation:'));
            console.log(chalk.gray(`      Required classes: ${fileResult.constraints.requiredClasses.join(', ') || 'none'}`));
            console.log(chalk.gray(`      Required properties: ${fileResult.constraints.requiredProperties.join(', ') || 'none'}`));
            console.log(chalk.gray(`      Data integrity: ${fileResult.constraints.dataIntegrity.join(', ') || 'none'}`));
          }
        }

        // Output summary
        console.log(chalk.blue('\n📊 Validation Summary'));
        console.log(chalk.blue('━'.repeat(30)));
        console.log(`Valid artifacts: ${chalk.green(result.validatedFiles.length)}`);
        console.log(`Errors: ${chalk.red(result.errors.length)}`);
        console.log(`Warnings: ${chalk.yellow(result.warnings.length)}`);
        console.log(`Skipped: ${chalk.gray(result.skippedFiles.length)}`);

        if (options.json) {
          console.log(chalk.blue('\n📄 JSON Results:'));
          console.log(JSON.stringify(result, null, 2));
        }

        if (options.exitCode && !result.success) {
          process.exit(1);
        }

      } catch (error) {
        console.error(chalk.red('Validation failed:'), error.message);
        if (options.exitCode) {
          process.exit(1);
        }
      }
    });
}