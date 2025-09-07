# Configuration API Reference

## Overview

Unjucks uses `c12` for advanced configuration management with TypeScript support, environment-specific settings, and hot-reloading capabilities. Configuration can be provided through multiple formats and sources with a clear precedence order.

## Configuration Files

### Supported Formats and Locations

Unjucks automatically loads configuration from these files in order of precedence:

1. `unjucks.config.ts` (TypeScript - recommended)
2. `unjucks.config.js` (JavaScript ES modules)  
3. `unjucks.config.mjs` (JavaScript ES modules)
4. `unjucks.config.cjs` (CommonJS)
5. `unjucks.config.json` (JSON)
6. `.unjucksrc` (JSON)
7. `package.json` (in `unjucks` field)

### Configuration File Locations

Configuration files are searched in this order:
1. Current working directory
2. `./config/` subdirectory
3. User home directory
4. System-wide configuration directories

## Configuration Schema

### Complete Configuration Interface

```typescript
interface UnjucksConfig {
  // Core template processing
  templates?: TemplateConfig;
  
  // Semantic web processing
  semantic?: SemanticConfig;
  
  // MCP server integration
  mcp?: MCPConfig;
  
  // Performance optimization
  performance?: PerformanceConfig;
  
  // Development tools
  development?: DevelopmentConfig;
  
  // Build and deployment
  build?: BuildConfig;
  
  // Plugins and extensions
  plugins?: PluginConfig[];
  
  // Environment-specific overrides
  environments?: Record<string, Partial<UnjucksConfig>>;
}
```

### Template Configuration

```typescript
interface TemplateConfig {
  // Template discovery and loading
  directories?: string[]; // default: ["_templates", "templates"]
  extensions?: string[];  // default: [".njk", ".nunjucks", ".ejs"]
  patterns?: string[];    // glob patterns for template discovery
  
  // Template processing
  engine?: TemplateEngine;
  globals?: Record<string, any>;
  filters?: Record<string, TemplateFilter>;
  functions?: Record<string, TemplateFunction>;
  
  // File generation
  outputEncoding?: string; // default: "utf8"
  preserveTimestamps?: boolean; // default: false
  createDirectories?: boolean; // default: true
  
  // Template validation
  strictMode?: boolean; // default: false
  validateSyntax?: boolean; // default: true
  validateVariables?: boolean; // default: false
  
  // Caching
  cache?: TemplateCacheConfig;
}

interface TemplateEngine {
  name: 'nunjucks' | 'ejs' | 'handlebars';
  options?: {
    autoescape?: boolean; // default: true
    throwOnUndefined?: boolean; // default: false
    trimBlocks?: boolean; // default: true
    lstripBlocks?: boolean; // default: false
    tags?: {
      blockStart?: string; // default: "{%"
      blockEnd?: string;   // default: "%}"
      variableStart?: string; // default: "{{"
      variableEnd?: string;   // default: "}}"
      commentStart?: string;  // default: "{#"
      commentEnd?: string;    // default: "#}"
    };
  };
}

interface TemplateCacheConfig {
  enabled?: boolean; // default: true
  maxSize?: number;  // default: 100
  ttl?: number;      // default: 3600 (1 hour)
  storage?: 'memory' | 'disk' | 'redis';
  redisUrl?: string; // if storage is 'redis'
}
```

### Semantic Configuration

```typescript
interface SemanticConfig {
  // RDF processing
  rdf?: RDFConfig;
  
  // SPARQL endpoints
  sparql?: SPARQLConfig;
  
  // Ontology management
  ontologies?: OntologyConfig;
  
  // Reasoning and inference
  reasoning?: ReasoningConfig;
  
  // Validation and compliance
  validation?: ValidationConfig;
  
  // Performance tuning
  performance?: SemanticPerformanceConfig;
}

interface RDFConfig {
  // Default format for RDF processing
  defaultFormat?: 'turtle' | 'n3' | 'jsonld' | 'rdfxml' | 'ntriples';
  
  // Base IRI for relative URIs
  baseIRI?: string;
  
  // Common prefixes
  prefixes?: Record<string, string>;
  
  // Processing limits
  maxTriples?: number; // default: 1000000
  timeout?: number;    // default: 30000ms
  
  // Quality control
  validateSyntax?: boolean; // default: true
  ignoreDuplicates?: boolean; // default: false
  normalizeLanguageTags?: boolean; // default: true
}

interface SPARQLConfig {
  endpoints?: Record<string, SPARQLEndpoint>;
  defaultEndpoint?: string;
  queryTimeout?: number; // default: 30000ms
  maxResults?: number;   // default: 10000
  enableFederation?: boolean; // default: false
  caching?: SPARQLCacheConfig;
}

interface SPARQLEndpoint {
  url: string;
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'oauth2';
    credentials?: string | {
      username: string;
      password: string;
    };
  };
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number; // default: 3
}

interface OntologyConfig {
  paths?: string[]; // paths to ontology files
  imports?: string[]; // URIs of ontologies to import
  validation?: {
    enabled?: boolean; // default: true
    level?: 'basic' | 'full'; // default: 'basic'
    reportInconsistencies?: boolean; // default: true
  };
  reasoning?: {
    enabled?: boolean; // default: false
    reasoner?: 'pellet' | 'hermit' | 'elk' | 'fact++';
    profile?: 'EL' | 'QL' | 'RL' | 'DL';
  };
}

interface ReasoningConfig {
  enabled?: boolean; // default: false
  engine?: 'n3' | 'jena' | 'pellet' | 'eye';
  maxDepth?: number; // default: 10
  maxInferences?: number; // default: 10000
  strategies?: ('forward' | 'backward' | 'hybrid')[];
  rules?: string[]; // paths to N3 rule files
  builtinRules?: string[]; // built-in rule sets to enable
}
```

### MCP Configuration

```typescript
interface MCPConfig {
  servers?: Record<string, MCPServerConfig>;
  timeout?: number; // default: 30000ms
  retries?: number; // default: 3
  concurrency?: number; // default: 10
  healthCheck?: {
    enabled?: boolean; // default: true
    interval?: number; // default: 30000ms
  };
}

interface MCPServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
  enabled?: boolean; // default: true
  retries?: number;
  healthCheck?: {
    endpoint?: string;
    timeout?: number;
  };
}
```

### Performance Configuration

```typescript
interface PerformanceConfig {
  // Concurrency limits
  maxConcurrentOperations?: number; // default: 10
  maxConcurrentFileWrites?: number; // default: 5
  
  // Memory management
  maxMemoryUsage?: string; // e.g., "2GB", default: "1GB"
  gcThreshold?: number; // default: 0.8
  
  // Processing optimization
  batchSize?: number; // default: 100
  chunkSize?: number; // default: 1000
  enableParallelization?: boolean; // default: true
  
  // Caching
  globalCache?: {
    enabled?: boolean; // default: true
    maxSize?: string; // e.g., "512MB"
    ttl?: number; // default: 3600 seconds
    strategy?: 'lru' | 'fifo' | 'lfu'; // default: 'lru'
  };
  
  // Monitoring
  metrics?: {
    enabled?: boolean; // default: false
    interval?: number; // default: 10000ms
    retention?: number; // default: 86400 seconds (24h)
  };
}
```

### Development Configuration

```typescript
interface DevelopmentConfig {
  // Hot reloading
  watch?: {
    enabled?: boolean; // default: false
    patterns?: string[]; // default: ["**/*.njk", "**/*.ts"]
    ignored?: string[]; // default: ["node_modules/**", ".git/**"]
    polling?: boolean; // default: false
    interval?: number; // default: 1000ms
  };
  
  // Debugging
  debug?: {
    enabled?: boolean; // default: false
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    logToFile?: boolean; // default: false
    logFile?: string; // default: "unjucks-debug.log"
  };
  
  // Development server
  server?: {
    enabled?: boolean; // default: false
    port?: number; // default: 3000
    host?: string; // default: "localhost"
    open?: boolean; // default: false
    cors?: boolean; // default: true
  };
}
```

### Build Configuration

```typescript
interface BuildConfig {
  // Output settings
  outDir?: string; // default: "dist"
  clean?: boolean; // default: true
  
  // Asset handling
  assets?: {
    copy?: AssetCopyConfig[];
    optimize?: boolean; // default: false
  };
  
  // Code transformation
  transform?: {
    typescript?: boolean; // default: auto-detect
    minify?: boolean; // default: false
    sourceMaps?: boolean; // default: false
  };
  
  // Bundling
  bundle?: {
    enabled?: boolean; // default: false
    format?: 'esm' | 'cjs' | 'umd';
    external?: string[];
    globals?: Record<string, string>;
  };
}

interface AssetCopyConfig {
  from: string;
  to: string;
  exclude?: string[];
}
```

## Default Configuration

```typescript
// unjucks.config.ts - Complete default configuration
import { defineConfig } from '@unjucks/core';

export default defineConfig({
  templates: {
    directories: ['_templates', 'templates'],
    extensions: ['.njk', '.nunjucks', '.ejs'],
    engine: {
      name: 'nunjucks',
      options: {
        autoescape: true,
        throwOnUndefined: false,
        trimBlocks: true,
        lstripBlocks: false
      }
    },
    cache: {
      enabled: true,
      maxSize: 100,
      ttl: 3600,
      storage: 'memory'
    },
    strictMode: false,
    validateSyntax: true,
    validateVariables: false
  },
  
  semantic: {
    rdf: {
      defaultFormat: 'turtle',
      baseIRI: 'https://example.org/',
      prefixes: {
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        owl: 'http://www.w3.org/2002/07/owl#',
        xsd: 'http://www.w3.org/2001/XMLSchema#'
      },
      maxTriples: 1000000,
      timeout: 30000,
      validateSyntax: true,
      ignoreDuplicates: false
    },
    
    sparql: {
      queryTimeout: 30000,
      maxResults: 10000,
      enableFederation: false,
      caching: {
        enabled: true,
        ttl: 1800, // 30 minutes
        maxSize: 50
      }
    },
    
    ontologies: {
      validation: {
        enabled: true,
        level: 'basic',
        reportInconsistencies: true
      }
    },
    
    reasoning: {
      enabled: false,
      engine: 'n3',
      maxDepth: 10,
      maxInferences: 10000
    },
    
    validation: {
      enabled: true,
      strictMode: false,
      complianceFrameworks: [],
      maxErrors: 100,
      timeout: 30000
    }
  },
  
  mcp: {
    timeout: 30000,
    retries: 3,
    concurrency: 10,
    servers: {
      'claude-flow': {
        command: 'npx',
        args: ['claude-flow@alpha', 'mcp', 'start'],
        enabled: true,
        timeout: 30000,
        retries: 3
      },
      'ruv-swarm': {
        command: 'npx',
        args: ['ruv-swarm@latest', 'mcp'],
        enabled: true,
        timeout: 45000,
        retries: 3
      },
      'flow-nexus': {
        command: 'npx', 
        args: ['@ruv/flow-nexus', 'mcp', 'start'],
        enabled: true,
        timeout: 60000,
        retries: 3
      }
    },
    healthCheck: {
      enabled: true,
      interval: 30000
    }
  },
  
  performance: {
    maxConcurrentOperations: 10,
    maxConcurrentFileWrites: 5,
    maxMemoryUsage: '1GB',
    batchSize: 100,
    chunkSize: 1000,
    enableParallelization: true,
    globalCache: {
      enabled: true,
      maxSize: '512MB',
      ttl: 3600,
      strategy: 'lru'
    },
    metrics: {
      enabled: false,
      interval: 10000,
      retention: 86400
    }
  },
  
  development: {
    watch: {
      enabled: false,
      patterns: ['**/*.njk', '**/*.ts', '**/*.js'],
      ignored: ['node_modules/**', '.git/**', 'dist/**'],
      polling: false,
      interval: 1000
    },
    debug: {
      enabled: false,
      level: 'info',
      logToFile: false
    }
  },
  
  build: {
    outDir: 'dist',
    clean: true,
    transform: {
      typescript: true,
      minify: false,
      sourceMaps: false
    }
  }
});
```

## Environment-Specific Configuration

### Environment Overrides

```typescript
// unjucks.config.ts - Environment-specific settings
export default defineConfig({
  // Base configuration
  templates: {
    cache: { enabled: true }
  },
  
  // Environment-specific overrides
  environments: {
    development: {
      development: {
        debug: { enabled: true, level: 'debug' },
        watch: { enabled: true }
      },
      performance: {
        metrics: { enabled: true }
      }
    },
    
    production: {
      templates: {
        cache: { storage: 'redis', ttl: 7200 }
      },
      performance: {
        maxConcurrentOperations: 20,
        maxMemoryUsage: '4GB',
        globalCache: { maxSize: '2GB' }
      },
      semantic: {
        validation: { strictMode: true }
      }
    },
    
    testing: {
      templates: {
        cache: { enabled: false }
      },
      development: {
        debug: { enabled: true, level: 'trace' }
      }
    }
  }
});
```

### Environment Detection

Unjucks automatically detects the environment using:

1. `NODE_ENV` environment variable
2. `UNJUCKS_ENV` environment variable  
3. `--env` command line flag
4. Default: `development`

```bash
# Set environment via command line
unjucks generate component react --env production

# Set via environment variable
NODE_ENV=production unjucks generate api express
UNJUCKS_ENV=testing unjucks semantic validate
```

## Custom Configuration Loading

### Programmatic Configuration

```typescript
import { loadConfig, defineConfig } from '@unjucks/core';

// Load configuration programmatically
const config = await loadConfig({
  // Override search paths
  configFile: './custom-config.ts',
  
  // Override defaults
  defaults: {
    templates: {
      directories: ['./my-templates']
    }
  },
  
  // Additional overrides
  overrides: {
    performance: {
      maxConcurrentOperations: 5
    }
  }
});

// Use configuration
const generator = new Generator(config);
```

### Configuration Validation

```typescript
import { validateConfig } from '@unjucks/core';

// Validate configuration at runtime
const result = await validateConfig(config);

if (!result.valid) {
  console.error('Configuration errors:', result.errors);
  process.exit(1);
}
```

### Dynamic Configuration

```typescript
// Dynamic configuration updates
import { updateConfig, getConfig } from '@unjucks/core';

// Get current configuration
const currentConfig = getConfig();

// Update configuration
await updateConfig({
  templates: {
    cache: { enabled: false }
  }
});

// Configuration with hot-reload
const config = defineConfig({
  // Enable configuration hot-reload
  hotReload: true,
  
  // Watch configuration files
  watchConfig: true
});
```

## Configuration Hooks and Plugins

### Configuration Lifecycle Hooks

```typescript
interface ConfigHooks {
  'config:loading': (config: Partial<UnjucksConfig>) => Partial<UnjucksConfig>;
  'config:loaded': (config: UnjucksConfig) => void;
  'config:validated': (config: UnjucksConfig, result: ValidationResult) => void;
  'config:updated': (config: UnjucksConfig, previous: UnjucksConfig) => void;
}

// Register hooks
import { addConfigHook } from '@unjucks/core';

addConfigHook('config:loading', (config) => {
  // Modify configuration during loading
  return {
    ...config,
    templates: {
      ...config.templates,
      globals: {
        ...config.templates?.globals,
        timestamp: new Date().toISOString()
      }
    }
  };
});
```

### Configuration Plugins

```typescript
interface ConfigPlugin {
  name: string;
  setup: (config: UnjucksConfig) => UnjucksConfig;
}

// Example plugin
const myPlugin: ConfigPlugin = {
  name: 'my-plugin',
  setup: (config) => ({
    ...config,
    templates: {
      ...config.templates,
      filters: {
        ...config.templates?.filters,
        myFilter: (value) => value.toUpperCase()
      }
    }
  })
};

// Use plugin
export default defineConfig({
  plugins: [myPlugin]
});
```

## Advanced Configuration Patterns

### Conditional Configuration

```typescript
// Conditional configuration based on environment
const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  templates: {
    cache: {
      enabled: !isDev,
      storage: isProd ? 'redis' : 'memory'
    }
  },
  
  development: {
    debug: {
      enabled: isDev,
      level: isDev ? 'debug' : 'info'
    }
  }
});
```

### Configuration Composition

```typescript
// Base configuration
const baseConfig = {
  templates: {
    directories: ['_templates']
  }
};

// Feature-specific configurations
const semanticConfig = {
  semantic: {
    rdf: { defaultFormat: 'turtle' }
  }
};

const performanceConfig = {
  performance: {
    maxConcurrentOperations: 20
  }
};

// Compose final configuration
export default defineConfig({
  ...baseConfig,
  ...semanticConfig,
  ...performanceConfig
});
```

### Configuration Schema Validation

```typescript
// Custom schema validation
import { z } from 'zod';

const CustomConfigSchema = z.object({
  templates: z.object({
    directories: z.array(z.string()).min(1),
    cache: z.object({
      enabled: z.boolean(),
      ttl: z.number().min(60).max(86400)
    }).optional()
  })
});

export default defineConfig({
  // Configuration will be validated against schema
  $schema: CustomConfigSchema,
  
  templates: {
    directories: ['_templates'],
    cache: {
      enabled: true,
      ttl: 3600
    }
  }
});
```

This configuration system provides enterprise-grade flexibility with type safety, environment management, and extensibility through hooks and plugins.