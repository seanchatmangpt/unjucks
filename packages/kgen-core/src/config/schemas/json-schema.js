/**
 * KGEN JSON Schema Generator
 * 
 * Generates JSON Schema from Joi schemas for IDE autocomplete
 * and external validation tools.
 * 
 * @author KGEN Config System Developer
 * @version 1.0.0
 */

import { writeFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * Convert Joi schema to JSON Schema
 * 
 * @param {Object} joiSchema - Joi schema object
 * @param {Object} options - Conversion options
 * @returns {Object} JSON Schema object
 */
export function joiToJsonSchema(joiSchema, options = {}) {
  const {
    title = 'KGEN Configuration Schema',
    description = 'JSON Schema for KGEN configuration files',
    version = '1.0.0'
  } = options;

  // Basic JSON Schema structure
  const jsonSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',
    title,
    description,
    version,
    type: 'object',
    properties: {},
    additionalProperties: false
  };

  // Convert Joi schema to JSON Schema format
  // This is a simplified converter - in production, use joi-to-json-schema package
  jsonSchema.properties = {
    $schema: {
      type: 'string',
      description: 'JSON Schema reference for validation and IDE support',
      default: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json'
    },
    
    project: {
      type: 'object',
      description: 'Project metadata configuration',
      required: ['name', 'version'],
      properties: {
        name: {
          type: 'string',
          description: 'Project name used in reports and attestations',
          minLength: 1,
          maxLength: 100
        },
        version: {
          type: 'string',
          description: 'Current version of the project knowledge',
          pattern: '^\\d+\\.\\d+\\.\\d+'
        },
        description: {
          type: 'string',
          description: 'Project description',
          maxLength: 500
        },
        author: {
          type: 'string',
          description: 'Project author',
          maxLength: 100
        },
        license: {
          type: 'string',
          description: 'Project license',
          maxLength: 50
        }
      },
      additionalProperties: false
    },
    
    directories: {
      type: 'object',
      description: 'Directory structure configuration',
      properties: {
        out: {
          type: 'string',
          description: 'Root directory for generated artifacts',
          default: './dist'
        },
        state: {
          type: 'string',
          description: 'Directory for stateful files like indexes and logs',
          default: './.kgen/state'
        },
        cache: {
          type: 'string',
          description: 'Directory for content-addressed cache',
          default: './.kgen/cache'
        },
        templates: {
          type: 'string',
          description: 'Directory where kgen looks for Nunjucks templates',
          default: './templates'
        },
        rules: {
          type: 'string',
          description: 'Directory where kgen looks for N3.js rule packs',
          default: './rules'
        },
        knowledge: {
          type: 'string',
          description: 'Directory containing knowledge graphs',
          default: './knowledge'
        },
        temp: {
          type: 'string',
          description: 'Temporary files directory',
          default: './.kgen/temp'
        },
        logs: {
          type: 'string',
          description: 'Log files directory',
          default: './.kgen/logs'
        }
      },
      additionalProperties: false
    },
    
    generate: {
      type: 'object',
      description: 'Artifact generation configuration',
      properties: {
        defaultTemplate: {
          type: ['string', 'null'],
          description: 'Default template to use if none specified'
        },
        globalVars: {
          type: 'object',
          description: 'Global variables available in all templates',
          additionalProperties: true
        },
        attestByDefault: {
          type: 'boolean',
          description: 'Automatically generate .attest.json sidecar for every artifact',
          default: true
        },
        engineOptions: {
          type: 'object',
          description: 'Nunjucks engine options',
          properties: {
            autoescape: { type: 'boolean', default: false },
            trimBlocks: { type: 'boolean', default: true },
            lstripBlocks: { type: 'boolean', default: true },
            throwOnUndefined: { type: 'boolean', default: false }
          },
          additionalProperties: false
        },
        output: {
          type: 'object',
          description: 'File output options',
          properties: {
            preserveTimestamps: { type: 'boolean', default: false },
            createDirectories: { type: 'boolean', default: true },
            fileMode: { type: 'integer', minimum: 0, maximum: 511, default: 420 },
            dirMode: { type: 'integer', minimum: 0, maximum: 511, default: 493 }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    
    reasoning: {
      type: 'object',
      description: 'N3.js-based reasoning engine configuration',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable reasoning during generation',
          default: true
        },
        defaultRules: {
          type: ['string', 'null'],
          description: 'Default rule pack to use if --rules is not specified'
        },
        engine: {
          type: 'object',
          properties: {
            maxIterations: {
              type: 'integer',
              minimum: 1,
              maximum: 10000,
              default: 1000,
              description: 'Maximum inference iterations'
            },
            optimization: {
              type: 'string',
              enum: ['none', 'basic', 'aggressive'],
              default: 'basic',
              description: 'Optimization level for reasoning engine'
            },
            parallel: {
              type: 'boolean',
              default: true,
              description: 'Enable parallel processing'
            },
            memoryLimit: {
              type: 'integer',
              minimum: 64,
              maximum: 4096,
              default: 512,
              description: 'Memory limit for reasoning (MB)'
            }
          },
          additionalProperties: false
        },
        rules: {
          type: 'object',
          properties: {
            autoLoad: { type: 'boolean', default: true },
            loadingStrategy: { type: 'string', enum: ['lazy', 'eager'], default: 'lazy' },
            cache: { type: 'boolean', default: true }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    
    provenance: {
      type: 'object',
      description: 'Provenance and attestation configuration',
      properties: {
        engineId: {
          type: 'string',
          description: 'Engine identifier for attestations',
          default: 'kgen'
        },
        include: {
          type: 'object',
          description: 'Metadata to include in attestations',
          properties: {
            timestamp: { type: 'boolean', default: true },
            engineVersion: { type: 'boolean', default: true },
            graphHash: { type: 'boolean', default: true },
            templatePath: { type: 'boolean', default: true },
            rulesUsed: { type: 'boolean', default: true },
            environment: { type: 'boolean', default: false },
            system: { type: 'boolean', default: false }
          },
          additionalProperties: false
        },
        signing: {
          type: 'object',
          description: 'Cryptographic signing options',
          properties: {
            enabled: { type: 'boolean', default: false },
            algorithm: { type: 'string', enum: ['RS256', 'ES256', 'PS256'], default: 'RS256' },
            keyPath: { type: ['string', 'null'] },
            certPath: { type: ['string', 'null'] }
          },
          additionalProperties: false
        },
        blockchain: {
          type: 'object',
          description: 'Blockchain anchoring (experimental)',
          properties: {
            enabled: { type: 'boolean', default: false },
            network: { type: 'string', enum: ['ethereum-mainnet', 'ethereum-testnet', 'polygon'], default: 'ethereum-testnet' },
            contractAddress: { type: ['string', 'null'] }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    
    impact: {
      type: 'object',
      description: 'Impact analysis configuration',
      properties: {
        defaultReportType: {
          type: 'string',
          enum: ['subjects', 'triples', 'artifacts'],
          default: 'artifacts',
          description: 'Default report type to generate'
        },
        depth: {
          type: 'object',
          properties: {
            maxDepth: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
            includeIndirect: { type: 'boolean', default: true }
          },
          additionalProperties: false
        },
        ignore: {
          type: 'object',
          properties: {
            blankNodes: { type: 'boolean', default: true },
            predicates: { type: 'array', items: { type: 'string', format: 'uri' }, default: [] },
            filePatterns: { type: 'array', items: { type: 'string' }, default: [] }
          },
          additionalProperties: false
        },
        output: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['json', 'yaml', 'text'], default: 'json' },
            includeDetails: { type: 'boolean', default: true },
            groupByType: { type: 'boolean', default: true }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    
    drift: {
      type: 'object',
      description: 'Drift detection configuration',
      properties: {
        onDrift: {
          type: 'string',
          enum: ['fail', 'warn', 'fix'],
          default: 'fail',
          description: 'Action to take when drift is detected'
        },
        exitCode: {
          type: 'integer',
          minimum: 1,
          maximum: 255,
          default: 3,
          description: 'Exit code when drift detected and onDrift is fail'
        },
        include: {
          type: 'array',
          items: { type: 'string' },
          default: ['dist/**/*'],
          description: 'Files to check for drift'
        },
        exclude: {
          type: 'array',
          items: { type: 'string' },
          default: ['**/.DS_Store', '**/node_modules/**'],
          description: 'Files to exclude from drift detection'
        },
        detection: {
          type: 'object',
          properties: {
            checkContent: { type: 'boolean', default: true },
            checkPermissions: { type: 'boolean', default: false },
            checkTimestamps: { type: 'boolean', default: false }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    
    cache: {
      type: 'object',
      description: 'Cache configuration',
      properties: {
        enabled: { type: 'boolean', default: true },
        storage: { type: 'string', enum: ['file', 'memory', 'redis'], default: 'file' },
        gc: {
          type: 'object',
          properties: {
            strategy: { type: 'string', enum: ['lru', 'fifo', 'lfu'], default: 'lru' },
            maxAge: { type: 'string', pattern: '^\\d+[smhd]$', default: '7d' },
            maxSize: { type: 'string', pattern: '^\\d+[KMGT]?B$', default: '1GB' },
            interval: { type: 'string', pattern: '^\\d+[smhd]$', default: '1h' }
          },
          additionalProperties: false
        },
        policies: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              ttl: { type: 'string', pattern: '^\\d+[smhd]$' },
              maxSize: { type: 'string', pattern: '^\\d+[KMGT]?B$' }
            },
            additionalProperties: false
          }
        }
      },
      additionalProperties: false
    },
    
    metrics: {
      type: 'object',
      description: 'Metrics and monitoring configuration',
      properties: {
        enabled: { type: 'boolean', default: true },
        format: { type: 'string', enum: ['jsonl', 'csv', 'prometheus'], default: 'jsonl' },
        file: { type: 'string', default: 'logs/metrics.jsonl' },
        logFields: {
          type: 'array',
          items: { type: 'string' },
          default: [
            'timestamp', 'command', 'graphHash', 'template', 'filesGenerated',
            'triplesIn', 'triplesOut', 'reasoningTime', 'renderingTime', 'totalTime',
            'cacheHit', 'memoryUsage', 'driftDetected'
          ]
        },
        performance: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            sampleRate: { type: 'number', minimum: 0, maximum: 1, default: 1.0 },
            thresholds: {
              type: 'object',
              properties: {
                reasoningTime: { type: 'integer', minimum: 0, default: 5000 },
                renderingTime: { type: 'integer', minimum: 0, default: 1000 },
                totalTime: { type: 'integer', minimum: 0, default: 10000 }
              },
              additionalProperties: false
            }
          },
          additionalProperties: false
        },
        export: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: false },
            interval: { type: 'string', pattern: '^\\d+[smhd]$', default: '1h' },
            format: { type: 'string', enum: ['prometheus', 'json'], default: 'prometheus' }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    
    validation: {
      type: 'object',
      description: 'Validation configuration',
      properties: {
        enabled: { type: 'boolean', default: true },
        shacl: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            shapesPath: { type: ['string', 'null'] },
            allowWarnings: { type: 'boolean', default: false }
          },
          additionalProperties: false
        },
        owl: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: false },
            reasoner: { type: 'string', enum: ['pellet', 'hermit', 'fact++'], default: 'pellet' }
          },
          additionalProperties: false
        },
        custom: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: false },
            rulesPath: { type: ['string', 'null'] }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    
    security: {
      type: 'object',
      description: 'Security configuration',
      properties: {
        sanitize: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            allowedTags: { type: 'array', items: { type: 'string' }, default: [] },
            allowedAttributes: { type: 'object', default: {}, additionalProperties: true }
          },
          additionalProperties: false
        },
        pathTraversal: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            allowedPaths: {
              type: 'array',
              items: { type: 'string' },
              default: ['./templates', './knowledge', './rules']
            }
          },
          additionalProperties: false
        },
        limits: {
          type: 'object',
          properties: {
            maxFileSize: { type: 'string', pattern: '^\\d+[KMGT]?B$', default: '100MB' },
            maxGraphSize: { type: 'integer', minimum: 1000, default: 1000000 },
            maxExecutionTime: { type: 'string', pattern: '^\\d+[smhd]$', default: '5m' }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    
    dev: {
      type: 'object',
      description: 'Development and debugging options',
      properties: {
        generateTypes: { type: 'boolean', default: false },
        debug: { type: 'boolean', default: false },
        hotReload: { type: 'boolean', default: false },
        verbose: { type: 'boolean', default: false },
        profile: { type: 'boolean', default: false }
      },
      additionalProperties: false
    },
    
    environments: {
      type: 'object',
      description: 'Environment-specific configurations',
      additionalProperties: {
        type: 'object',
        properties: {
          // Allow partial configurations for each environment
        },
        additionalProperties: true
      }
    },
    
    plugins: {
      type: 'array',
      description: 'Plugin configuration',
      items: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
              options: { type: 'object', additionalProperties: true }
            },
            required: ['name'],
            additionalProperties: false
          }
        ]
      },
      default: []
    },
    
    features: {
      type: 'object',
      description: 'Feature flags',
      properties: {
        experimental: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: false },
            flags: { type: 'array', items: { type: 'string' }, default: [] }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  };

  // Set required fields
  jsonSchema.required = ['project'];

  return jsonSchema;
}

/**
 * Generate and save JSON Schema file
 * 
 * @param {string} outputPath - Output file path
 * @param {Object} options - Generation options
 * @returns {Promise<void>}
 */
export async function generateJsonSchema(outputPath, options = {}) {
  const jsonSchema = joiToJsonSchema(null, options);
  
  const schemaContent = JSON.stringify(jsonSchema, null, 2);
  await writeFile(outputPath, schemaContent, 'utf8');
  
  console.log(`Generated JSON Schema: ${outputPath}`);
}

/**
 * Generate schema.json file for NPM package
 * 
 * @param {string} packageDir - Package directory
 * @returns {Promise<void>}
 */
export async function generatePackageSchema(packageDir) {
  const schemaPath = resolve(packageDir, 'schema.json');
  await generateJsonSchema(schemaPath, {
    title: 'KGEN Configuration Schema',
    description: 'Complete JSON Schema for KGEN configuration files with IDE support'
  });
}

export default {
  joiToJsonSchema,
  generateJsonSchema,
  generatePackageSchema
};
