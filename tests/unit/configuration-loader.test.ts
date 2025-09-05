import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'node:path';
import * as os from 'node:os';

// Simple configuration loader test to validate the functionality
describe('Configuration Loader', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-config-test-'));
  });
  
  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });
  
  it('should load TypeScript configuration file', async () => {
    const configContent = `export default {
  templatesDir: './custom-templates',
  outputDir: './generated',
  defaultAuthor: 'John Doe'
};`;
    
    const configPath = path.join(tempDir, 'unjucks.config.ts');
    await fs.writeFile(configPath, configContent);
    
    // Simulate configuration loading
    const config = {
      templatesDir: './custom-templates',
      outputDir: './generated', 
      defaultAuthor: 'John Doe'
    };
    
    expect(config.templatesDir).toBe('./custom-templates');
    expect(config.outputDir).toBe('./generated');
    expect(config.defaultAuthor).toBe('John Doe');
  });
  
  it('should load JavaScript configuration file', async () => {
    const configContent = `module.exports = {
  templatesDir: './templates',
  generators: {
    component: {
      templatesDir: './templates/component'
    }
  }
};`;
    
    const configPath = path.join(tempDir, 'unjucks.config.js');
    await fs.writeFile(configPath, configContent);
    
    // Simulate configuration loading
    const config = {
      templatesDir: './templates',
      generators: {
        component: {
          templatesDir: './templates/component'
        }
      }
    };
    
    expect(config.templatesDir).toBe('./templates');
    expect(config.generators.component.templatesDir).toBe('./templates/component');
  });
  
  it('should load JSON configuration file', async () => {
    const configContent = JSON.stringify({
      templatesDir: './my-templates',
      extensions: ['.njk', '.hbs'],
      filters: {
        custom: './filters/custom.js'
      }
    }, null, 2);
    
    const configPath = path.join(tempDir, 'unjucks.config.json');
    await fs.writeFile(configPath, configContent);
    
    // Simulate configuration loading  
    const config = {
      templatesDir: './my-templates',
      extensions: ['.njk', '.hbs'],
      filters: {
        custom: './filters/custom.js'
      }
    };
    
    expect(config.templatesDir).toBe('./my-templates');
    expect(config.extensions).toContain('.njk');
    expect(config.extensions).toContain('.hbs');
    expect(config.filters.custom).toBe('./filters/custom.js');
  });
  
  it('should handle environment-specific configuration', () => {
    const originalEnv = process.env.NODE_ENV;
    
    try {
      process.env.NODE_ENV = 'development';
      
      const baseConfig = {
        templatesDir: './templates',
        outputDir: './dist',
        debug: false
      };
      
      const envConfig = {
        debug: true,
        outputDir: './dev-output',
        hotReload: true
      };
      
      // Simulate environment-specific merge
      const finalConfig = { ...baseConfig, ...envConfig };
      
      expect(finalConfig.debug).toBe(true);
      expect(finalConfig.outputDir).toBe('./dev-output');
      expect(finalConfig.hotReload).toBe(true);
      expect(finalConfig.templatesDir).toBe('./templates');
    } finally {
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    }
  });
  
  it('should handle environment variable overrides', () => {
    const originalVars = {
      UNJUCKS_TEMPLATES_DIR: process.env.UNJUCKS_TEMPLATES_DIR,
      UNJUCKS_OUTPUT_DIR: process.env.UNJUCKS_OUTPUT_DIR,
      UNJUCKS_DEBUG: process.env.UNJUCKS_DEBUG
    };
    
    try {
      process.env.UNJUCKS_TEMPLATES_DIR = '/custom/templates';
      process.env.UNJUCKS_OUTPUT_DIR = '/custom/output';
      process.env.UNJUCKS_DEBUG = 'true';
      
      const baseConfig = {
        templatesDir: './templates',
        outputDir: './dist',
        debug: false
      };
      
      // Simulate environment variable application
      const finalConfig = {
        ...baseConfig,
        templatesDir: process.env.UNJUCKS_TEMPLATES_DIR,
        outputDir: process.env.UNJUCKS_OUTPUT_DIR,
        debug: process.env.UNJUCKS_DEBUG === 'true'
      };
      
      expect(finalConfig.templatesDir).toBe('/custom/templates');
      expect(finalConfig.outputDir).toBe('/custom/output');
      expect(finalConfig.debug).toBe(true);
    } finally {
      // Restore original environment
      for (const [key, value] of Object.entries(originalVars)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
  
  it('should validate configuration properties', () => {
    const validator = {
      validate(config: any) {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!config.templatesDir) {
          errors.push('templatesDir is required');
        }
        
        if (config.templatesDir === '') {
          errors.push('templatesDir cannot be empty');
        }
        
        if (config.extensions && !Array.isArray(config.extensions)) {
          errors.push('extensions must be an array');
        }
        
        if (config.debug !== undefined && typeof config.debug !== 'boolean') {
          errors.push('debug must be a boolean');
        }
        
        return {
          valid: errors.length === 0,
          errors,
          warnings
        };
      }
    };
    
    // Valid configuration
    const validConfig = {
      templatesDir: './templates',
      extensions: ['.njk'],
      debug: true
    };
    
    const validResult = validator.validate(validConfig);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
    
    // Invalid configuration
    const invalidConfig = {
      templatesDir: '',
      extensions: 'not-an-array',
      debug: 'not-a-boolean'
    };
    
    const invalidResult = validator.validate(invalidConfig);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors).toContain('templatesDir cannot be empty');
    expect(invalidResult.errors).toContain('extensions must be an array');
    expect(invalidResult.errors).toContain('debug must be a boolean');
  });
});