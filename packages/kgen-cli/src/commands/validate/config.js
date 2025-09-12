#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { pathToFileURL } from 'url';
import chalk from 'chalk';
import Ajv from 'ajv';
// import addFormats from 'ajv-formats'; // Temporarily disabled
const addFormats = () => {}; // Stub function

/**
 * KGEN configuration schema for validation
 */
const KGEN_CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    // Core configuration
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+(-[\\w\\.-]+)?$',
      description: 'KGEN configuration version'
    },
    
    // Graph configuration
    graph: {
      type: 'object',
      properties: {
        input: {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' }
            }
          ],
          description: 'Input RDF graph files'
        },
        format: {
          type: 'string',
          enum: ['turtle', 'n3', 'jsonld', 'ntriples', 'rdfxml'],
          default: 'turtle',
          description: 'RDF input format'
        },
        baseIRI: {
          type: 'string',
          format: 'uri',
          description: 'Base IRI for relative URIs'
        },
        prefixes: {
          type: 'object',
          patternProperties: {
            '^[a-zA-Z][a-zA-Z0-9]*$': {
              type: 'string',
              format: 'uri'
            }
          },
          description: 'Namespace prefix mappings'
        }
      },
      required: ['input'],
      additionalProperties: false
    },

    // Template configuration
    templates: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Templates directory path'
        },
        engine: {
          type: 'string',
          enum: ['handlebars', 'mustache', 'nunjucks'],
          default: 'handlebars',
          description: 'Template engine'
        },
        globals: {
          type: 'object',
          description: 'Global template variables'
        },
        helpers: {
          type: 'object',
          description: 'Custom template helpers'
        }
      },
      required: ['directory'],
      additionalProperties: false
    },

    // Rules configuration
    rules: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Rules directory path'
        },
        engine: {
          type: 'string',
          enum: ['n3', 'sparql', 'shacl'],
          default: 'n3',
          description: 'Rules engine'
        },
        entailment: {
          type: 'string',
          enum: ['rdfs', 'owl', 'none'],
          default: 'none',
          description: 'Entailment regime'
        }
      },
      additionalProperties: false
    },

    // Output configuration
    output: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Output directory path'
        },
        clean: {
          type: 'boolean',
          default: false,
          description: 'Clean output directory before generation'
        },
        preserve: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns of files to preserve when cleaning'
        }
      },
      required: ['directory'],
      additionalProperties: false
    },

    // Validation configuration
    validation: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Enable validation'
        },
        shapes: {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' }
            }
          ],
          description: 'SHACL shapes files for validation'
        },
        strict: {
          type: 'boolean',
          default: false,
          description: 'Treat warnings as errors'
        }
      },
      additionalProperties: false
    },

    // Provenance configuration
    provenance: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          default: true,
          description: 'Enable provenance tracking'
        },
        attestation: {
          type: 'string',
          description: 'Attestation file path'
        },
        sign: {
          type: 'boolean',
          default: false,
          description: 'Enable cryptographic signing'
        },
        keyring: {
          type: 'string',
          description: 'Keyring file for signing'
        }
      },
      additionalProperties: false
    },

    // Performance configuration
    performance: {
      type: 'object',
      properties: {
        parallel: {
          type: 'boolean',
          default: true,
          description: 'Enable parallel processing'
        },
        maxConcurrency: {
          type: 'integer',
          minimum: 1,
          maximum: 64,
          default: 4,
          description: 'Maximum concurrent operations'
        },
        cache: {
          type: 'boolean',
          default: true,
          description: 'Enable caching'
        }
      },
      additionalProperties: false
    },

    // Plugin configuration
    plugins: {
      type: 'array',
      items: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
              options: { type: 'object' }
            },
            required: ['name'],
            additionalProperties: false
          }
        ]
      },
      description: 'KGEN plugins to load'
    }
  },
  required: ['graph', 'output'],
  additionalProperties: false
};

/**
 * Configuration validator
 */
class ConfigValidator {
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false 
    });
    addFormats(this.ajv);
    
    this.validate = this.ajv.compile(KGEN_CONFIG_SCHEMA);
  }

  /**
   * Load configuration file
   * @param {string} configPath - Path to config file
   * @returns {Object} Loaded configuration
   */
  async loadConfig(configPath) {
    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const ext = configPath.split('.').pop().toLowerCase();
    
    try {
      switch (ext) {
        case 'js':
        case 'mjs':
          // Dynamic import for ES modules
          const configUrl = pathToFileURL(configPath).href;
          const module = await import(configUrl);
          return module.default || module;
          
        case 'json':
          const jsonContent = readFileSync(configPath, 'utf8');
          return JSON.parse(jsonContent);
          
        case 'ts':
          throw new Error('TypeScript config files require compilation first');
          
        default:
          throw new Error(`Unsupported config file format: ${ext}`);
      }
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation results
   */
  validateConfig(config) {
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Schema validation
    const isValid = this.validate(config);
    
    if (!isValid) {
      results.valid = false;
      results.errors = this.validate.errors.map(error => ({
        path: error.instancePath || error.schemaPath,
        message: error.message,
        value: error.data,
        schema: error.schema
      }));
    }

    // Additional semantic validation
    this.validateSemanticConstraints(config, results);
    this.validateFileReferences(config, results);
    this.generateSuggestions(config, results);

    return results;
  }

  /**
   * Validate semantic constraints beyond schema
   * @param {Object} config - Configuration object
   * @param {Object} results - Results object to populate
   */
  validateSemanticConstraints(config, results) {
    // Check for conflicting options
    if (config.output?.clean && (!config.output?.preserve || config.output.preserve.length === 0)) {
      results.warnings.push({
        path: '/output/clean',
        message: 'Clean mode enabled without preserve patterns - all files will be deleted'
      });
    }

    // Check performance settings
    if (config.performance?.parallel === false && config.performance?.maxConcurrency > 1) {
      results.warnings.push({
        path: '/performance',
        message: 'Parallel processing disabled but maxConcurrency > 1'
      });
    }

    // Check template engine compatibility
    if (config.templates?.engine === 'mustache' && config.templates?.helpers) {
      results.warnings.push({
        path: '/templates/helpers',
        message: 'Mustache template engine does not support custom helpers'
      });
    }

    // Check validation settings
    if (config.validation?.enabled && !config.validation?.shapes) {
      results.warnings.push({
        path: '/validation',
        message: 'Validation enabled but no SHACL shapes specified'
      });
    }

    // Check provenance settings
    if (config.provenance?.sign && !config.provenance?.keyring) {
      results.errors.push({
        path: '/provenance/sign',
        message: 'Cryptographic signing enabled but no keyring specified'
      });
    }
  }

  /**
   * Validate file references exist
   * @param {Object} config - Configuration object
   * @param {Object} results - Results object to populate
   */
  validateFileReferences(config, results) {
    const checkPath = (path, configPath) => {
      if (path && !existsSync(resolve(path))) {
        results.warnings.push({
          path: configPath,
          message: `Referenced file/directory not found: ${path}`
        });
      }
    };

    // Check input files
    if (config.graph?.input) {
      const inputs = Array.isArray(config.graph.input) ? config.graph.input : [config.graph.input];
      inputs.forEach(input => checkPath(input, '/graph/input'));
    }

    // Check directories
    checkPath(config.templates?.directory, '/templates/directory');
    checkPath(config.rules?.directory, '/rules/directory');

    // Check validation shapes
    if (config.validation?.shapes) {
      const shapes = Array.isArray(config.validation.shapes) ? config.validation.shapes : [config.validation.shapes];
      shapes.forEach(shape => checkPath(shape, '/validation/shapes'));
    }

    // Check provenance keyring
    checkPath(config.provenance?.keyring, '/provenance/keyring');
  }

  /**
   * Generate configuration suggestions
   * @param {Object} config - Configuration object
   * @param {Object} results - Results object to populate
   */
  generateSuggestions(config, results) {
    // Suggest enabling provenance if disabled
    if (config.provenance?.enabled === false) {
      results.suggestions.push({
        path: '/provenance/enabled',
        message: 'Consider enabling provenance tracking for better auditability'
      });
    }

    // Suggest validation if disabled
    if (config.validation?.enabled === false) {
      results.suggestions.push({
        path: '/validation/enabled',
        message: 'Consider enabling validation to catch semantic errors early'
      });
    }

    // Suggest caching if disabled
    if (config.performance?.cache === false) {
      results.suggestions.push({
        path: '/performance/cache',
        message: 'Consider enabling caching for better performance'
      });
    }

    // Suggest parallel processing if disabled
    if (config.performance?.parallel === false) {
      results.suggestions.push({
        path: '/performance/parallel',
        message: 'Consider enabling parallel processing for large projects'
      });
    }
  }
}

/**
 * Create validate config command
 * @returns {Command} The configured validate config command
 */
export function createValidateConfigCommand() {
  return new Command('config')
    .description('Validate KGEN configuration file for syntax and semantic correctness')
    .argument('[configFile]', 'Path to kgen.config.js file', 'kgen.config.js')
    .option('--json', 'Output results in JSON format')
    .option('-v, --verbose', 'Show detailed validation information')
    .option('--exit-code', 'Exit with non-zero code if validation fails')
    .option('--suggestions', 'Show configuration suggestions', true)
    .action(async (configFile, options) => {
      try {
        console.log(chalk.blue('⚙️  Configuration Validation'));
        console.log(chalk.blue('━'.repeat(30)));

        const validator = new ConfigValidator();
        const configPath = resolve(configFile);

        console.log(chalk.blue(`📋 Loading configuration: ${configFile}`));

        // Load configuration
        const config = await validator.loadConfig(configPath);
        console.log(chalk.green('  ✓ Configuration loaded successfully'));

        if (options.verbose) {
          console.log(chalk.gray(`    Type: ${configPath.split('.').pop().toUpperCase()}`));
          console.log(chalk.gray(`    Keys: ${Object.keys(config).join(', ')}`));
        }

        // Validate configuration
        console.log(chalk.blue('\n🔍 Validating configuration...'));
        const results = validator.validateConfig(config);

        // Display results
        console.log(chalk.blue('\n📊 Validation Results'));
        console.log(chalk.blue('━'.repeat(25)));

        if (results.valid) {
          console.log(chalk.green('✅ Configuration is valid'));
        } else {
          console.log(chalk.red('❌ Configuration has errors'));
        }

        console.log(`Errors: ${chalk.red(results.errors.length)}`);
        console.log(`Warnings: ${chalk.yellow(results.warnings.length)}`);
        console.log(`Suggestions: ${chalk.blue(results.suggestions.length)}`);

        // Show errors
        if (results.errors.length > 0) {
          console.log(chalk.red('\n🚫 Errors:'));
          console.log(chalk.red('━'.repeat(15)));
          results.errors.forEach((error, index) => {
            console.log(chalk.red(`${index + 1}. ${error.message}`));
            if (error.path) {
              console.log(chalk.gray(`   Path: ${error.path}`));
            }
            if (error.value !== undefined) {
              console.log(chalk.gray(`   Value: ${JSON.stringify(error.value)}`));
            }
            console.log('');
          });
        }

        // Show warnings
        if (results.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          console.log(chalk.yellow('━'.repeat(15)));
          results.warnings.forEach((warning, index) => {
            console.log(chalk.yellow(`${index + 1}. ${warning.message}`));
            if (warning.path) {
              console.log(chalk.gray(`   Path: ${warning.path}`));
            }
            console.log('');
          });
        }

        // Show suggestions
        if (results.suggestions.length > 0 && options.suggestions) {
          console.log(chalk.blue('\n💡 Suggestions:'));
          console.log(chalk.blue('━'.repeat(15)));
          results.suggestions.forEach((suggestion, index) => {
            console.log(chalk.blue(`${index + 1}. ${suggestion.message}`));
            if (suggestion.path) {
              console.log(chalk.gray(`   Path: ${suggestion.path}`));
            }
            console.log('');
          });
        }

        // JSON output
        if (options.json) {
          const jsonResult = {
            valid: results.valid,
            errors: results.errors,
            warnings: results.warnings,
            suggestions: results.suggestions,
            configFile: configPath,
            timestamp: this.getDeterministicDate().toISOString()
          };

          console.log(chalk.blue('\n📄 JSON Results:'));
          console.log(JSON.stringify(jsonResult, null, 2));
        }

        if (options.exitCode && !results.valid) {
          process.exit(1);
        }

      } catch (error) {
        console.error(chalk.red('Configuration validation failed:'), error.message);
        if (options.exitCode) {
          process.exit(1);
        }
      }
    });
}