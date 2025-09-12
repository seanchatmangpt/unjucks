/**
 * Configuration Validation Tests
 * 
 * Tests configuration validation schemas, error handling,
 * and validation behavior with different config formats.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { loadConfig } from 'c12';

const originalEnv = { ...process.env };

// Mock validation schema
const configSchema = {
  type: 'object',
  properties: {
    directories: {
      type: 'object',
      required: ['out'],
      properties: {
        out: { type: 'string', minLength: 1 },
        state: { type: 'string', minLength: 1 },
        cache: { type: 'string', minLength: 1 },
        templates: { type: 'string', minLength: 1 },
        rules: { type: 'string', minLength: 1 }
      }
    },
    generate: {
      type: 'object',
      properties: {
        defaultTemplate: { type: 'string', minLength: 1 },
        attestByDefault: { type: 'boolean' },
        parallel: { type: 'boolean' },
        maxConcurrency: { type: 'integer', minimum: 1, maximum: 16 }
      }
    },
    reasoning: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        maxDepth: { type: 'integer', minimum: 1, maximum: 100 },
        timeout: { type: 'integer', minimum: 1000 }
      }
    },
    security: {
      type: 'object',
      properties: {
        sandbox: { type: 'boolean' },
        maxMemory: { type: 'string', pattern: '^\\d+(MB|GB)$' },
        allowedModules: { 
          type: 'array', 
          items: { type: 'string' } 
        }
      }
    }
  },
  required: ['directories']
};

// Simple validation function for testing
function validateConfig(config, schema) {
  const errors = [];
  
  function validateObject(obj, schemaObj, path = '') {
    if (schemaObj.required) {
      for (const req of schemaObj.required) {
        if (!(req in obj)) {
          errors.push(`Missing required field: ${path}${req}`);
        }
      }
    }
    
    if (schemaObj.properties) {
      for (const [key, value] of Object.entries(obj)) {
        if (schemaObj.properties[key]) {
          const prop = schemaObj.properties[key];
          const newPath = path ? `${path}${key}.` : `${key}.`;
          
          if (prop.type === 'object') {
            if (typeof value !== 'object' || value === null) {
              errors.push(`Invalid type for ${path}${key}: expected object, got ${typeof value}`);
            } else {
              validateObject(value, prop, newPath);
            }
          } else if (prop.type === 'string') {
            if (typeof value !== 'string') {
              errors.push(`Invalid type for ${path}${key}: expected string, got ${typeof value}`);
            } else if (prop.minLength && value.length < prop.minLength) {
              errors.push(`String too short for ${path}${key}: minimum length ${prop.minLength}`);
            } else if (prop.pattern && !new RegExp(prop.pattern).test(value)) {
              errors.push(`String format invalid for ${path}${key}: must match pattern ${prop.pattern}`);
            }
          } else if (prop.type === 'boolean') {
            if (typeof value !== 'boolean') {
              errors.push(`Invalid type for ${path}${key}: expected boolean, got ${typeof value}`);
            }
          } else if (prop.type === 'integer') {
            if (!Number.isInteger(value)) {
              errors.push(`Invalid type for ${path}${key}: expected integer, got ${typeof value}`);
            } else if (prop.minimum !== undefined && value < prop.minimum) {
              errors.push(`Value too small for ${path}${key}: minimum ${prop.minimum}`);
            } else if (prop.maximum !== undefined && value > prop.maximum) {
              errors.push(`Value too large for ${path}${key}: maximum ${prop.maximum}`);
            }
          } else if (prop.type === 'array') {
            if (!Array.isArray(value)) {
              errors.push(`Invalid type for ${path}${key}: expected array, got ${typeof value}`);
            }
          }
        }
      }
    }
  }
  
  validateObject(config, schema);
  return { valid: errors.length === 0, errors };
}

describe('Configuration Validation Tests', () => {
  let testDir;
  let configPath;

  beforeEach(() => {
    testDir = join(tmpdir(), `kgen-validation-test-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`);
    mkdirSync(testDir, { recursive: true });
    configPath = join(testDir, 'kgen.config.js');
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    process.env = { ...originalEnv };
  });

  describe('Schema Validation', () => {
    it('should validate a correct configuration', async () => {
      const validConfigContent = `
        export default {
          directories: {
            out: './dist',
            state: './.kgen/state',
            cache: './.kgen/cache',
            templates: './templates',
            rules: './rules'
          },
          generate: {
            defaultTemplate: 'basic',
            attestByDefault: true,
            parallel: true,
            maxConcurrency: 4
          },
          reasoning: {
            enabled: true,
            maxDepth: 10,
            timeout: 30000
          },
          security: {
            sandbox: true,
            maxMemory: '512MB',
            allowedModules: ['@kgen/*', 'lodash']
          }
        };
      `;
      
      writeFileSync(configPath, validConfigContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      const validation = validateConfig(config, configSchema);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should detect missing required fields', async () => {
      const invalidConfigContent = `
        export default {
          // Missing required 'directories' field
          generate: {
            defaultTemplate: 'basic'
          }
        };
      `;
      
      writeFileSync(configPath, invalidConfigContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      const validation = validateConfig(config, configSchema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required field: directories');
    });

    it('should detect type validation errors', async () => {
      const invalidConfigContent = `
        export default {
          directories: {
            out: './dist'
          },
          generate: {
            defaultTemplate: 123,      // Should be string
            attestByDefault: 'true',   // Should be boolean
            maxConcurrency: 'four'     // Should be integer
          },
          reasoning: {
            enabled: 'yes',            // Should be boolean
            maxDepth: -5               // Should be positive integer
          },
          security: {
            allowedModules: 'lodash'   // Should be array
          }
        };
      `;
      
      writeFileSync(configPath, invalidConfigContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      const validation = validateConfig(config, configSchema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid type for generate.defaultTemplate: expected string, got number');
      expect(validation.errors).toContain('Invalid type for generate.attestByDefault: expected boolean, got string');
      expect(validation.errors).toContain('Invalid type for generate.maxConcurrency: expected integer, got string');
      expect(validation.errors).toContain('Invalid type for reasoning.enabled: expected boolean, got string');
      expect(validation.errors).toContain('Value too small for reasoning.maxDepth: minimum 1');
      expect(validation.errors).toContain('Invalid type for security.allowedModules: expected array, got string');
    });

    it('should validate string patterns and lengths', async () => {
      const invalidConfigContent = `
        export default {
          directories: {
            out: '',                    // Too short (minLength: 1)
            state: './.kgen/state'
          },
          security: {
            maxMemory: '512KB'          // Invalid pattern (should be MB or GB)
          }
        };
      `;
      
      writeFileSync(configPath, invalidConfigContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      const validation = validateConfig(config, configSchema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('String too short for directories.out: minimum length 1');
      expect(validation.errors).toContain('String format invalid for security.maxMemory: must match pattern ^\\d+(MB|GB)$');
    });

    it('should validate numeric ranges', async () => {
      const invalidConfigContent = `
        export default {
          directories: {
            out: './dist'
          },
          generate: {
            maxConcurrency: 0          // Below minimum (1)
          },
          reasoning: {
            maxDepth: 150,             // Above maximum (100)
            timeout: 500               // Below minimum (1000)
          }
        };
      `;
      
      writeFileSync(configPath, invalidConfigContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      const validation = validateConfig(config, configSchema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Value too small for generate.maxConcurrency: minimum 1');
      expect(validation.errors).toContain('Value too large for reasoning.maxDepth: maximum 100');
      expect(validation.errors).toContain('Value too small for reasoning.timeout: minimum 1000');
    });
  });

  describe('Environment-Specific Validation', () => {
    it('should validate merged environment configurations', async () => {
      process.env.NODE_ENV = 'production';
      
      const configContent = `
        export default {
          directories: {
            out: './dist'
          },
          generate: {
            maxConcurrency: 4
          },
          production: {
            generate: {
              maxConcurrency: 20        // Invalid: exceeds maximum of 16
            }
          }
        };
      `;
      
      writeFileSync(configPath, configContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      // After c12 merging, the production value should be applied
      expect(config.generate.maxConcurrency).toBe(20);
      
      const validation = validateConfig(config, configSchema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Value too large for generate.maxConcurrency: maximum 16');
    });

    it('should validate environment variable substitutions', async () => {
      process.env.KGEN_MAX_MEMORY = 'invalid-format';
      process.env.KGEN_TIMEOUT = 'not-a-number';
      
      const configContent = `
        export default {
          directories: {
            out: './dist'
          },
          security: {
            maxMemory: process.env.KGEN_MAX_MEMORY || '512MB'
          },
          reasoning: {
            timeout: parseInt(process.env.KGEN_TIMEOUT) || 30000
          }
        };
      `;
      
      writeFileSync(configPath, configContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      expect(config.security.maxMemory).toBe('invalid-format');
      expect(config.reasoning.timeout).toBe(NaN); // parseInt('not-a-number') returns NaN
      
      const validation = validateConfig(config, configSchema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('String format invalid for security.maxMemory: must match pattern ^\\d+(MB|GB)$');
      expect(validation.errors).toContain('Invalid type for reasoning.timeout: expected integer, got number');
    });
  });

  describe('Partial Configuration Validation', () => {
    it('should validate partial configurations with defaults', async () => {
      const partialConfigContent = `
        export default {
          directories: {
            out: './custom-dist'
            // Other directory fields will come from defaults
          }
          // generate, reasoning, security will come from defaults
        };
      `;
      
      writeFileSync(configPath, partialConfigContent);
      
      const defaults = {
        directories: {
          out: './dist',
          state: './.kgen/state',
          cache: './.kgen/cache',
          templates: './templates',
          rules: './rules'
        },
        generate: {
          defaultTemplate: 'basic',
          attestByDefault: true,
          parallel: true,
          maxConcurrency: 4
        },
        reasoning: {
          enabled: true,
          maxDepth: 10,
          timeout: 30000
        }
      };

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config',
        defaults
      });

      // Custom value should override default
      expect(config.directories.out).toBe('./custom-dist');
      // Default values should be used for missing fields
      expect(config.directories.state).toBe('./.kgen/state');
      expect(config.generate.defaultTemplate).toBe('basic');

      const validation = validateConfig(config, configSchema);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should validate empty configuration with defaults', async () => {
      const emptyConfigContent = `
        export default {};
      `;
      
      writeFileSync(configPath, emptyConfigContent);
      
      const defaults = {
        directories: {
          out: './dist',
          state: './.kgen/state'
        }
      };

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config',
        defaults
      });

      const validation = validateConfig(config, configSchema);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(config.directories.out).toBe('./dist');
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should validate deeply nested configuration objects', async () => {
      const complexConfigContent = `
        export default {
          directories: {
            out: './dist'
          },
          custom: {
            nested: {
              deeply: {
                buried: {
                  value: 'test'
                }
              }
            }
          }
        };
      `;
      
      writeFileSync(configPath, complexConfigContent);
      
      // Extend schema for custom nested validation
      const extendedSchema = {
        ...configSchema,
        properties: {
          ...configSchema.properties,
          custom: {
            type: 'object',
            properties: {
              nested: {
                type: 'object',
                properties: {
                  deeply: {
                    type: 'object',
                    properties: {
                      buried: {
                        type: 'object',
                        properties: {
                          value: { type: 'string', minLength: 1 }
                        },
                        required: ['value']
                      }
                    },
                    required: ['buried']
                  }
                },
                required: ['deeply']
              }
            },
            required: ['nested']
          }
        }
      };

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      const validation = validateConfig(config, extendedSchema);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(config.custom.nested.deeply.buried.value).toBe('test');
    });

    it('should provide detailed validation error paths', async () => {
      const invalidNestedConfigContent = `
        export default {
          directories: {
            out: './dist'
          },
          custom: {
            nested: {
              deeply: {
                buried: {
                  // Missing required 'value' field
                }
              }
            }
          }
        };
      `;
      
      writeFileSync(configPath, invalidNestedConfigContent);
      
      const extendedSchema = {
        ...configSchema,
        properties: {
          ...configSchema.properties,
          custom: {
            type: 'object',
            properties: {
              nested: {
                type: 'object',
                properties: {
                  deeply: {
                    type: 'object',
                    properties: {
                      buried: {
                        type: 'object',
                        properties: {
                          value: { type: 'string', minLength: 1 }
                        },
                        required: ['value']
                      }
                    },
                    required: ['buried']
                  }
                },
                required: ['deeply']
              }
            },
            required: ['nested']
          }
        }
      };

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      const validation = validateConfig(config, extendedSchema);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required field: custom.nested.deeply.buried.value');
    });
  });

  describe('Configuration Format-Specific Validation', () => {
    it('should validate JSON configuration format constraints', async () => {
      // JSON cannot contain functions or undefined values
      const jsonConfigPath = join(testDir, 'kgen.config.json');
      const jsonConfig = {
        directories: {
          out: './dist'
        },
        generate: {
          defaultTemplate: 'basic',
          // JSON cannot contain functions - this would be lost
          globalVars: {
            timestamp: null // JSON representation of function
          }
        }
      };
      
      writeFileSync(jsonConfigPath, JSON.stringify(jsonConfig, null, 2));
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      // Functions are lost in JSON serialization
      expect(config.generate.globalVars.timestamp).toBe(null);
      
      const validation = validateConfig(config, configSchema);
      expect(validation.valid).toBe(true); // Still valid according to schema
    });

    it('should handle JavaScript-specific features in validation', async () => {
      const jsConfigContent = `
        export default {
          directories: {
            out: './dist'
          },
          generate: {
            globalVars: {
              timestamp: () => this.getDeterministicDate().toISOString(),
              computed: process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
            }
          }
        };
      `;
      
      writeFileSync(configPath, jsConfigContent);
      
      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config'
      });

      // JavaScript features should be preserved
      expect(typeof config.generate.globalVars.timestamp).toBe('function');
      expect(typeof config.generate.globalVars.computed).toBe('string');
      
      const validation = validateConfig(config, configSchema);
      expect(validation.valid).toBe(true);
    });
  });
});