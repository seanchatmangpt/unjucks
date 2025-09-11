# KGEN Configuration System

A comprehensive, c12-based configuration system for KGEN knowledge compilation with full schema validation, IDE autocomplete support, and environment-aware loading.

## Features

- **c12-based Loading**: Automatic discovery and merging of configuration files
- **Schema Validation**: Joi-based validation with detailed error reporting
- **IDE Support**: Full TypeScript definitions and JSON Schema for autocomplete
- **Environment Merging**: Environment-specific configuration overrides
- **File Watching**: Hot-reload configuration changes during development
- **Extensive Examples**: Pre-built configurations for common scenarios
- **Performance Optimized**: Caching and lazy loading for production use

## Quick Start

### Installation

```bash
npm install @kgen/config
```

### Basic Usage

```javascript
import { loadKGenConfig, defineKGenConfig } from '@kgen/config';

// Load configuration with automatic discovery
const config = await loadKGenConfig();

// Or define configuration with type safety
const config = defineKGenConfig({
  project: {
    name: 'my-kgen-project',
    version: '1.0.0'
  },
  
  directories: {
    out: './dist',
    templates: './templates',
    rules: './rules'
  },
  
  generate: {
    defaultTemplate: 'api-service',
    attestByDefault: true
  },
  
  reasoning: {
    enabled: true,
    defaultRules: 'enterprise-governance'
  }
});
```

### Configuration File

Create a `kgen.config.js` file in your project root:

```javascript
// @ts-check

/**
 * @typedef {import('@kgen/config').KGenConfig} KGenConfig
 */

/**
 * @param {KGenConfig} config
 * @returns {KGenConfig}
 */
const defineConfig = (config) => config;

export default defineConfig({
  $schema: 'https://unpkg.com/@seanchatmangpt/kgen/schema.json',
  
  project: {
    name: 'my-knowledge-project',
    version: '1.0.0',
    description: 'Knowledge-driven application'
  },
  
  directories: {
    out: './dist/generated',
    state: './.kgen/state',
    cache: './.kgen/cache',
    templates: './kgen/templates',
    rules: './kgen/rules',
    knowledge: './knowledge'
  },
  
  generate: {
    defaultTemplate: 'api-service',
    globalVars: {
      author: 'Your Name',
      license: 'MIT',
      timestamp: () => new Date().toISOString()
    },
    attestByDefault: true
  },
  
  reasoning: {
    enabled: true,
    defaultRules: 'api-governance@1.2.0',
    engine: {
      optimization: 'basic',
      parallel: true
    }
  },
  
  provenance: {
    engineId: 'my-kgen-compiler',
    include: {
      timestamp: true,
      graphHash: true,
      templatePath: true,
      rulesUsed: true
    }
  },
  
  cache: {
    enabled: true,
    gc: {
      strategy: 'lru',
      maxAge: '7d',
      maxSize: '1GB'
    }
  },
  
  metrics: {
    enabled: true,
    file: 'logs/kgen-metrics.jsonl'
  }
});
```

## Configuration Options

### Project Metadata

```javascript
project: {
  name: 'my-project',        // Required: Project name
  version: '1.0.0',          // Required: Semantic version
  description: 'Description', // Optional: Project description
  author: 'Author Name',      // Optional: Author
  license: 'MIT'              // Optional: License
}
```

### Directory Structure

```javascript
directories: {
  out: './dist',              // Generated artifacts output
  state: './.kgen/state',     // Stateful files (indexes, logs)
  cache: './.kgen/cache',     // Content-addressed cache
  templates: './templates',    // Nunjucks templates
  rules: './rules',           // N3.js rule packs
  knowledge: './knowledge',    // Knowledge graphs
  temp: './.kgen/temp',       // Temporary files
  logs: './.kgen/logs'        // Log files
}
```

### Generation Settings

```javascript
generate: {
  defaultTemplate: 'api-service',     // Default template
  globalVars: {                       // Global template variables
    author: 'John Doe',
    license: 'MIT'
  },
  attestByDefault: true,              // Generate .attest.json sidecars
  engineOptions: {                    // Nunjucks options
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true
  }
}
```

### Reasoning Engine

```javascript
reasoning: {
  enabled: true,                      // Enable N3.js reasoning
  defaultRules: 'governance@1.0.0',   // Default rule pack
  engine: {
    maxIterations: 1000,              // Max inference iterations
    optimization: 'basic',            // 'none', 'basic', 'aggressive'
    parallel: true,                   // Parallel processing
    memoryLimit: 512                  // Memory limit (MB)
  },
  rules: {
    autoLoad: true,                   // Auto-load rules from directory
    loadingStrategy: 'lazy',          // 'lazy' or 'eager'
    cache: true                       // Cache compiled rules
  }
}
```

### Provenance & Attestation

```javascript
provenance: {
  engineId: 'my-kgen-compiler',       // Engine identifier
  include: {                          // Metadata to include
    timestamp: true,
    engineVersion: true,
    graphHash: true,
    templatePath: true,
    rulesUsed: true
  },
  signing: {                          // Cryptographic signing
    enabled: true,
    algorithm: 'RS256',
    keyPath: './certs/signing.key',
    certPath: './certs/signing.crt'
  },
  blockchain: {                       // Blockchain anchoring
    enabled: false,
    network: 'ethereum-testnet'
  }
}
```

### Impact Analysis

```javascript
impact: {
  defaultReportType: 'artifacts',     // 'subjects', 'triples', 'artifacts'
  depth: {
    maxDepth: 10,                     // Graph traversal depth
    includeIndirect: true             // Include indirect dependencies
  },
  ignore: {
    blankNodes: true,                 // Ignore blank node changes
    predicates: [                     // Predicates to ignore
      'http://purl.org/dc/terms/modified'
    ],
    filePatterns: ['**/.DS_Store']    // File patterns to ignore
  }
}
```

### Cache Configuration

```javascript
cache: {
  enabled: true,                      // Enable caching
  storage: 'file',                    // 'file', 'memory', 'redis'
  gc: {                              // Garbage collection
    strategy: 'lru',                  // 'lru', 'fifo', 'lfu'
    maxAge: '7d',                     // Max age (time units: s, m, h, d)
    maxSize: '1GB',                   // Max size (size units: KB, MB, GB)
    interval: '1h'                    // GC interval
  },
  policies: {                        // Type-specific policies
    graphs: {
      ttl: '1h',
      maxSize: '100MB'
    }
  }
}
```

### Metrics & Monitoring

```javascript
metrics: {
  enabled: true,                      // Enable metrics collection
  format: 'jsonl',                    // 'jsonl', 'csv', 'prometheus'
  file: 'logs/metrics.jsonl',         // Metrics file path
  logFields: [                        // Fields to log
    'timestamp', 'command', 'graphHash',
    'filesGenerated', 'reasoningTime'
  ],
  performance: {
    enabled: true,                    // Performance monitoring
    sampleRate: 1.0,                  // Sample rate (0-1)
    thresholds: {                     // Performance thresholds (ms)
      reasoningTime: 5000,
      renderingTime: 1000,
      totalTime: 10000
    }
  },
  export: {
    enabled: false,                   // Auto-export metrics
    interval: '1h',                   // Export interval
    format: 'prometheus'              // Export format
  }
}
```

## Environment Configuration

KGEN supports environment-specific configuration overrides:

```javascript
export default {
  // Base configuration
  project: {
    name: 'my-project',
    version: '1.0.0'
  },
  
  cache: {
    enabled: true
  },
  
  // Environment-specific overrides
  environments: {
    development: {
      cache: {
        enabled: false        // Disable cache in development
      },
      dev: {
        debug: true,
        verbose: true
      }
    },
    
    production: {
      reasoning: {
        engine: {
          optimization: 'aggressive'  // Aggressive optimization in prod
        }
      },
      metrics: {
        export: {
          enabled: true               // Enable metric export in prod
        }
      }
    },
    
    test: {
      cache: { enabled: false },
      metrics: { enabled: false }
    }
  }
};
```

## Advanced Usage

### Custom Configuration Manager

```javascript
import { KGenConfigManager } from '@kgen/config';

const configManager = new KGenConfigManager({
  configName: 'my-custom.config',
  envPrefix: 'MY_APP_',
  globalRc: false
});

const config = await configManager.load({
  cwd: '/path/to/project',
  overrides: {
    dev: { debug: true }
  }
});
```

### Configuration Validation

```javascript
import { validateConfiguration, ValidationError } from '@kgen/config/validators';

try {
  const validatedConfig = await validateConfiguration(config);
  console.log('Configuration is valid!');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:');
    console.error(error.getFormattedMessage());
    
    // Get errors by section
    const errorsBySection = error.getErrorsBySection();
    console.log('Errors by section:', errorsBySection);
  }
}
```

### File Watching

```javascript
const unwatch = await configManager.watch(
  { cwd: process.cwd() },
  (error, newConfig) => {
    if (error) {
      console.error('Config watch error:', error);
    } else {
      console.log('Configuration updated:', newConfig.project.name);
    }
  }
);

// Stop watching
// unwatch();
```

### Environment Validation

```javascript
import { validateEnvironment } from '@kgen/config/validators';

const warnings = await validateEnvironment(config, 'production');
if (warnings.length > 0) {
  console.warn('Production environment warnings:');
  warnings.forEach(warning => console.warn(`  - ${warning}`));
}
```

## Example Configurations

The package includes several pre-built example configurations:

```javascript
import { exampleConfigs } from '@kgen/config/examples';

// Minimal configuration
const minimal = exampleConfigs.minimal;

// Development configuration
const development = exampleConfigs.development;

// Production configuration
const production = exampleConfigs.production;

// Enterprise configuration with full compliance
const enterprise = exampleConfigs.enterprise;

// Test configuration
const test = exampleConfigs.test;

// API service configuration
const apiService = exampleConfigs.apiService;
```

## IDE Support

### TypeScript

The package provides complete TypeScript definitions:

```typescript
import type { KGenConfig } from '@kgen/config';

const config: KGenConfig = {
  project: {
    name: 'typed-project',
    version: '1.0.0'
  }
  // Full IntelliSense support
};
```

### JSON Schema

For JSON/YAML configuration files, add the schema reference:

```json
{
  "$schema": "https://unpkg.com/@seanchatmangpt/kgen/schema.json",
  "project": {
    "name": "my-project",
    "version": "1.0.0"
  }
}
```

### JSDoc Support

For JavaScript files with JSDoc:

```javascript
// @ts-check

/**
 * @typedef {import('@kgen/config').KGenConfig} KGenConfig
 */

/**
 * @type {KGenConfig}
 */
const config = {
  project: {
    name: 'jsdoc-project',
    version: '1.0.0'
  }
  // IntelliSense works here too!
};
```

## Performance

### Caching

Configurations are automatically cached for performance:

```javascript
// First load - reads from disk
const config1 = await loadKGenConfig({ cache: true });

// Second load - returns cached version
const config2 = await loadKGenConfig({ cache: true });

// Same instance
console.log(config1 === config2); // true
```

### Lazy Loading

Large configurations can be loaded lazily:

```javascript
const config = await loadKGenConfig({
  reasoning: {
    rules: {
      loadingStrategy: 'lazy'  // Load rules on-demand
    }
  }
});
```

## Error Handling

The configuration system provides detailed error reporting:

```javascript
try {
  const config = await loadKGenConfig({ validate: true });
} catch (error) {
  if (error.name === 'ValidationError') {
    // Detailed validation errors
    console.error(error.getFormattedMessage());
    
    // Programmatic access to errors
    error.details.forEach(detail => {
      console.log(`${detail.path}: ${detail.message}`);
    });
  } else {
    // Other errors (file not found, syntax errors, etc.)
    console.error('Configuration error:', error.message);
  }
}
```

## API Reference

### Functions

- `loadKGenConfig(options?)` - Load configuration with automatic discovery
- `defineKGenConfig(config)` - Type-safe configuration definition helper
- `validateConfiguration(config, options?)` - Validate configuration object
- `validateEnvironment(config, environment)` - Environment-specific validation

### Classes

- `KGenConfigManager(options?)` - Configuration manager with caching and watching
- `ValidationError` - Enhanced validation error with detailed reporting

### Types

- `KGenConfig` - Main configuration interface
- All section-specific interfaces (e.g., `GenerateConfig`, `ReasoningConfig`)

## Contributing

Contributions are welcome! Please read the contributing guidelines and ensure all tests pass:

```bash
npm test
npm run lint
npm run format
```

## License

MIT License - see LICENSE file for details.
