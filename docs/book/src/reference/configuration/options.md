# Configuration Reference - Complete Options Documentation

This comprehensive reference covers all Unjucks configuration options, schemas, and validation rules.

## Table of Contents

- [Configuration Files](#configuration-files)
- [Configuration Schema](#configuration-schema)
- [Project Configuration](#project-configuration)
- [Template Configuration](#template-configuration)
- [Environment Variables](#environment-variables)
- [Validation Rules](#validation-rules)
- [TypeScript Interfaces](#typescript-interfaces)

## Configuration Files

Unjucks supports multiple configuration file formats and locations:

### File Locations (in priority order)

1. `unjucks.config.ts` - TypeScript configuration
2. `unjucks.config.js` - JavaScript configuration  
3. `unjucks.config.mjs` - ES module configuration
4. `unjucks.yml` - YAML configuration
5. `unjucks.yaml` - YAML configuration (alternative)
6. `unjucks.json` - JSON configuration
7. `.unjucksrc` - JSON configuration (dotfile)
8. `package.json` - Configuration in "unjucks" field

### Configuration Resolution

Unjucks uses [c12](https://github.com/unjs/c12) for configuration loading, which provides:
- Automatic file discovery
- Environment-specific overrides
- Merge strategies for complex configurations
- TypeScript support with full IntelliSense

## Configuration Schema

### Root Configuration Interface

```typescript
export interface UnjucksConfig {
  // Core settings
  templatesDir?: string;
  outputDir?: string;
  cacheDir?: string;
  
  // Template processing
  templateEngine?: TemplateEngineConfig;
  fileOperations?: FileOperationsConfig;
  
  // Generation behavior
  defaults?: DefaultsConfig;
  hooks?: HooksConfig;
  
  // Performance and caching
  performance?: PerformanceConfig;
  cache?: CacheConfig;
  
  // Security and validation
  security?: SecurityConfig;
  validation?: ValidationConfig;
  
  // Semantic web capabilities
  semantic?: SemanticConfig;
  
  // Enterprise features
  enterprise?: EnterpriseConfig;
  
  // Development and debugging
  development?: DevelopmentConfig;
  
  // Plugin system
  plugins?: PluginConfig[];
}
```

### Template Engine Configuration

```typescript
export interface TemplateEngineConfig {
  // Nunjucks settings
  nunjucks?: {
    autoescape?: boolean;
    throwOnUndefined?: boolean;
    trimBlocks?: boolean;
    lstripBlocks?: boolean;
    tags?: {
      blockStart?: string;
      blockEnd?: string;
      variableStart?: string;
      variableEnd?: string;
      commentStart?: string;
      commentEnd?: string;
    };
    globals?: Record<string, any>;
  };
  
  // Custom filters
  filters?: Record<string, FilterFunction>;
  
  // Variable processing
  variables?: {
    // Type inference settings
    typeInference?: boolean;
    strictTypes?: boolean;
    
    // Default values
    defaults?: Record<string, any>;
    
    // Variable transformation
    transforms?: VariableTransformConfig[];
  };
  
  // EJS compatibility
  ejs?: {
    enabled?: boolean;
    delimiter?: string;
    openDelimiter?: string;
    closeDelimiter?: string;
  };
}

export type FilterFunction = (value: any, ...args: any[]) => any;

export interface VariableTransformConfig {
  match: string | RegExp;
  transform: (value: any) => any;
  when?: 'before' | 'after';
}
```

### File Operations Configuration

```typescript
export interface FileOperationsConfig {
  // File creation settings
  creation?: {
    // Default file permissions
    fileMode?: number | string;
    directoryMode?: number | string;
    
    // Backup settings
    backup?: {
      enabled?: boolean;
      suffix?: string;
      directory?: string;
      maxBackups?: number;
    };
  };
  
  // Injection settings
  injection?: {
    // Safe injection patterns
    safePatterns?: string[];
    dangerousPatterns?: string[];
    
    // Default injection behavior
    defaultMode?: 'inject' | 'append' | 'prepend';
    
    // Idempotency settings
    idempotency?: {
      enabled?: boolean;
      markers?: {
        start?: string;
        end?: string;
      };
    };
  };
  
  // Path handling
  paths?: {
    // Path resolution
    allowAbsolute?: boolean;
    allowTraversal?: boolean;
    
    // Path normalization
    normalizePaths?: boolean;
    caseSensitive?: boolean;
    
    // Restricted paths
    restrictedPaths?: string[];
    allowedPaths?: string[];
  };
}
```

### Performance Configuration

```typescript
export interface PerformanceConfig {
  // Concurrency settings
  concurrency?: {
    maxConcurrentFiles?: number;
    maxConcurrentTemplates?: number;
    useWorkerThreads?: boolean;
  };
  
  // Memory management
  memory?: {
    maxMemoryUsage?: number; // in MB
    enableGC?: boolean;
    gcThreshold?: number;
  };
  
  // Template compilation
  compilation?: {
    precompile?: boolean;
    cacheCompiled?: boolean;
    optimizeTemplates?: boolean;
  };
  
  // Batch processing
  batching?: {
    enabled?: boolean;
    batchSize?: number;
    debounceMs?: number;
  };
}
```

### Cache Configuration

```typescript
export interface CacheConfig {
  // Cache enablement
  enabled?: boolean;
  
  // Cache location
  directory?: string;
  
  // Cache strategies
  strategies?: {
    templates?: CacheStrategy;
    generators?: CacheStrategy;
    variables?: CacheStrategy;
    results?: CacheStrategy;
  };
  
  // Cache lifecycle
  lifecycle?: {
    ttl?: number; // Time to live in seconds
    maxSize?: number; // Max cache size in MB
    cleanupInterval?: number; // Cleanup interval in seconds
  };
  
  // Cache keys
  keyGeneration?: {
    includeContent?: boolean;
    includeTimestamp?: boolean;
    customKeyFn?: (context: any) => string;
  };
}

export type CacheStrategy = 'memory' | 'disk' | 'hybrid' | 'none';
```

### Security Configuration

```typescript
export interface SecurityConfig {
  // Path security
  pathSecurity?: {
    allowSymlinks?: boolean;
    restrictToProject?: boolean;
    blockedPaths?: string[];
    allowedExtensions?: string[];
    blockedExtensions?: string[];
  };
  
  // Template security
  templateSecurity?: {
    allowArbitraryCode?: boolean;
    restrictedGlobals?: string[];
    maxIncludeDepth?: number;
    allowNetworkAccess?: boolean;
  };
  
  // Input sanitization
  sanitization?: {
    enabled?: boolean;
    strict?: boolean;
    allowHtml?: boolean;
    customRules?: SanitizationRule[];
  };
  
  // Audit logging
  audit?: {
    enabled?: boolean;
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    logFile?: string;
    includeStackTrace?: boolean;
  };
}

export interface SanitizationRule {
  pattern: string | RegExp;
  replacement: string | ((match: string) => string);
  flags?: string;
}
```

### Semantic Web Configuration

```typescript
export interface SemanticConfig {
  // RDF processing
  rdf?: {
    // Default format
    defaultFormat?: 'turtle' | 'n-triples' | 'rdf-xml' | 'json-ld';
    
    // Parsing options
    parsing?: {
      strict?: boolean;
      validateSyntax?: boolean;
      ignoreDuplicates?: boolean;
    };
    
    // Namespace management
    namespaces?: Record<string, string>;
    defaultNamespace?: string;
  };
  
  // SPARQL querying
  sparql?: {
    enabled?: boolean;
    endpoint?: string;
    timeout?: number;
    maxResults?: number;
  };
  
  // Ontology validation
  validation?: {
    enabled?: boolean;
    ontologies?: string[];
    strictMode?: boolean;
    complianceFrameworks?: ComplianceFramework[];
  };
  
  // Type conversion
  typeConversion?: {
    enabled?: boolean;
    outputFormat?: 'typescript' | 'json-schema' | 'zod';
    namingConvention?: 'camelCase' | 'PascalCase' | 'kebab-case' | 'snake_case';
  };
}

export type ComplianceFramework = 'GDPR' | 'HIPAA' | 'SOX' | 'FHIR' | 'FIBO' | 'GS1';
```

### Enterprise Configuration

```typescript
export interface EnterpriseConfig {
  // Multi-tenancy
  multiTenant?: {
    enabled?: boolean;
    isolationLevel?: 'strict' | 'moderate' | 'relaxed';
    tenantIdExtraction?: (context: any) => string;
  };
  
  // Role-based access
  rbac?: {
    enabled?: boolean;
    roles?: RoleConfig[];
    defaultRole?: string;
  };
  
  // Monitoring and telemetry
  telemetry?: {
    enabled?: boolean;
    endpoint?: string;
    apiKey?: string;
    metrics?: string[];
  };
  
  // High availability
  highAvailability?: {
    enabled?: boolean;
    replicationFactor?: number;
    healthCheckInterval?: number;
  };
}

export interface RoleConfig {
  name: string;
  permissions: string[];
  restrictions?: {
    paths?: string[];
    templates?: string[];
    operations?: string[];
  };
}
```

## Project Configuration

### Basic Project Setup

```yaml
# unjucks.yml
templatesDir: "_templates"
outputDir: "./generated"
cacheDir: ".unjucks-cache"

# Template processing
templateEngine:
  nunjucks:
    autoescape: false
    throwOnUndefined: false
    trimBlocks: true
    lstripBlocks: true
  
  variables:
    typeInference: true
    defaults:
      author: "Development Team"
      year: 2024

# Performance optimization
performance:
  concurrency:
    maxConcurrentFiles: 10
    maxConcurrentTemplates: 5
  
  memory:
    maxMemoryUsage: 512 # MB

# Caching strategy
cache:
  enabled: true
  strategies:
    templates: "disk"
    generators: "memory"
    variables: "hybrid"
```

### Advanced Project Configuration

```typescript
// unjucks.config.ts
import { defineConfig } from 'unjucks';

export default defineConfig({
  templatesDir: '_templates',
  
  // Custom filters
  templateEngine: {
    filters: {
      slugify: (str: string) => 
        str.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      
      formatDate: (date: Date, format: string = 'YYYY-MM-DD') => {
        // Custom date formatting logic
        return new Intl.DateTimeFormat('en-US').format(date);
      }
    },
    
    // Global variables available in all templates
    nunjucks: {
      globals: {
        PROJECT_NAME: process.env.PROJECT_NAME || 'MyProject',
        BUILD_TIME: new Date().toISOString(),
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    }
  },
  
  // File operation rules
  fileOperations: {
    creation: {
      fileMode: 0o644,
      directoryMode: 0o755,
      backup: {
        enabled: true,
        suffix: '.bak',
        maxBackups: 5
      }
    },
    
    injection: {
      defaultMode: 'inject',
      idempotency: {
        enabled: true,
        markers: {
          start: '// UNJUCKS-START',
          end: '// UNJUCKS-END'
        }
      }
    },
    
    paths: {
      allowAbsolute: false,
      allowTraversal: false,
      restrictedPaths: ['/etc', '/var', '/usr']
    }
  },
  
  // Security configuration
  security: {
    pathSecurity: {
      allowSymlinks: false,
      restrictToProject: true,
      allowedExtensions: ['.ts', '.js', '.json', '.md', '.yml']
    },
    
    templateSecurity: {
      allowArbitraryCode: false,
      maxIncludeDepth: 5,
      allowNetworkAccess: false
    },
    
    audit: {
      enabled: true,
      logLevel: 'info',
      logFile: './logs/unjucks-audit.log'
    }
  },
  
  // Semantic web features
  semantic: {
    rdf: {
      defaultFormat: 'turtle',
      namespaces: {
        'ex': 'http://example.org/',
        'schema': 'http://schema.org/',
        'foaf': 'http://xmlns.com/foaf/0.1/'
      }
    },
    
    validation: {
      enabled: true,
      complianceFrameworks: ['GDPR', 'HIPAA']
    }
  },
  
  // Development settings
  development: {
    enableSourceMaps: true,
    watchFiles: true,
    liveReload: true,
    debugMode: process.env.NODE_ENV === 'development'
  }
});
```

## Template Configuration

### Generator Configuration

Each generator can have its own `config.yml` file:

```yaml
# _templates/component/config.yml
name: "component"
description: "Generate React/Vue components"
category: "frontend"

templates:
  - name: "react"
    description: "React functional component"
    files:
      - "{{ name | pascalCase }}.tsx"
      - "{{ name | pascalCase }}.test.tsx"
      - "index.ts"
    
    variables:
      - name: "name"
        type: "string"
        required: true
        description: "Component name"
        
      - name: "withTests"
        type: "boolean"
        default: true
        description: "Include test files"
        
      - name: "componentType"
        type: "string"
        default: "functional"
        choices: ["functional", "class"]
        description: "Component implementation type"
    
    prompts:
      - name: "name"
        message: "What is the component name?"
        type: "input"
        
      - name: "withTests"
        message: "Include test files?"
        type: "confirm"
        default: true
        
      - name: "componentType"
        message: "Component type:"
        type: "list"
        choices: 
          - "functional"
          - "class"
        default: "functional"
```

### Template-specific Configuration

Individual templates can override generator settings:

```yaml
# _templates/component/react/config.yml
extends: "../config.yml"

# Override or add template-specific settings
variables:
  - name: "withHooks"
    type: "boolean" 
    default: true
    description: "Include React hooks"
    
  - name: "styleType"
    type: "string"
    choices: ["css", "scss", "styled-components"]
    default: "css"

# Template-specific processing rules
processing:
  skipIf:
    - condition: "componentType == 'class' && withHooks"
      message: "Class components cannot use hooks"
      
  validation:
    - field: "name"
      pattern: "^[A-Z][a-zA-Z0-9]*$"
      message: "Component name must be PascalCase"
```

## Environment Variables

Unjucks configuration can be overridden by environment variables:

### Standard Variables

```bash
# Core directories
export UNJUCKS_TEMPLATES_DIR="_templates"
export UNJUCKS_OUTPUT_DIR="./generated"  
export UNJUCKS_CACHE_DIR=".unjucks-cache"

# Template processing
export UNJUCKS_TEMPLATE_ENGINE="nunjucks"
export UNJUCKS_AUTOESCAPE="false"
export UNJUCKS_TRIM_BLOCKS="true"

# Performance settings
export UNJUCKS_MAX_CONCURRENT_FILES="10"
export UNJUCKS_MAX_MEMORY_USAGE="512"
export UNJUCKS_ENABLE_CACHE="true"

# Security settings  
export UNJUCKS_ALLOW_ABSOLUTE_PATHS="false"
export UNJUCKS_ALLOW_SYMLINKS="false"
export UNJUCKS_RESTRICT_TO_PROJECT="true"

# Development settings
export UNJUCKS_DEBUG="true"
export UNJUCKS_ENABLE_SOURCE_MAPS="true"
export UNJUCKS_WATCH_FILES="true"

# Semantic features
export UNJUCKS_SEMANTIC_ENABLED="true"
export UNJUCKS_RDF_DEFAULT_FORMAT="turtle"
export UNJUCKS_SPARQL_ENDPOINT="http://localhost:3030/sparql"
```

### Environment-specific Overrides

```bash
# Development
NODE_ENV=development npm run unjucks generate

# Production  
NODE_ENV=production npm run unjucks generate

# Testing
NODE_ENV=test npm run unjucks generate
```

Configuration resolution for different environments:

```typescript
// unjucks.config.ts
export default defineConfig({
  // Base configuration
  templatesDir: '_templates',
  
  // Environment-specific overrides
  $development: {
    development: {
      debugMode: true,
      enableSourceMaps: true,
      watchFiles: true
    },
    cache: {
      enabled: false // Disable cache in development
    }
  },
  
  $production: {
    performance: {
      concurrency: {
        maxConcurrentFiles: 20,
        useWorkerThreads: true
      }
    },
    cache: {
      enabled: true,
      strategies: {
        templates: 'disk',
        generators: 'disk'
      }
    },
    security: {
      audit: {
        enabled: true,
        logLevel: 'warn'
      }
    }
  },
  
  $test: {
    templatesDir: 'test/_templates',
    outputDir: 'test/fixtures/output',
    development: {
      debugMode: false
    },
    cache: {
      enabled: false
    }
  }
});
```

## Validation Rules

### Configuration Validation Schema

Unjucks validates configuration using JSON Schema:

```typescript
export const UnjucksConfigSchema = {
  type: 'object',
  properties: {
    templatesDir: {
      type: 'string',
      pattern: '^[^/].*[^/]$', // No leading/trailing slashes
      minLength: 1
    },
    
    outputDir: {
      type: 'string',
      minLength: 1
    },
    
    templateEngine: {
      type: 'object',
      properties: {
        nunjucks: {
          type: 'object',
          properties: {
            autoescape: { type: 'boolean' },
            throwOnUndefined: { type: 'boolean' },
            trimBlocks: { type: 'boolean' },
            lstripBlocks: { type: 'boolean' }
          }
        }
      }
    },
    
    performance: {
      type: 'object',
      properties: {
        concurrency: {
          type: 'object',
          properties: {
            maxConcurrentFiles: {
              type: 'number',
              minimum: 1,
              maximum: 100
            },
            maxConcurrentTemplates: {
              type: 'number', 
              minimum: 1,
              maximum: 50
            }
          }
        },
        
        memory: {
          type: 'object',
          properties: {
            maxMemoryUsage: {
              type: 'number',
              minimum: 64,
              maximum: 8192 // 8GB
            }
          }
        }
      }
    },
    
    security: {
      type: 'object',
      properties: {
        pathSecurity: {
          type: 'object',
          properties: {
            allowedExtensions: {
              type: 'array',
              items: {
                type: 'string',
                pattern: '^\\.[a-zA-Z0-9]+$'
              }
            }
          }
        }
      }
    }
  }
};
```

### Runtime Validation

Configuration is validated at runtime with helpful error messages:

```typescript
// Invalid configuration example
const invalidConfig = {
  templatesDir: '/absolute/path', // ERROR: Should be relative
  performance: {
    concurrency: {
      maxConcurrentFiles: 200 // ERROR: Exceeds maximum of 100
    }
  },
  security: {
    pathSecurity: {
      allowedExtensions: ['txt'] // ERROR: Missing dot prefix
    }
  }
};

// Validation errors:
// ✗ templatesDir: Must be a relative path (no leading slash)
// ✗ performance.concurrency.maxConcurrentFiles: Must be ≤ 100
// ✗ security.pathSecurity.allowedExtensions[0]: Must start with dot (e.g., '.txt')
```

### Custom Validation Rules

You can add custom validation rules:

```typescript
// unjucks.config.ts
export default defineConfig({
  // Custom validation function
  validate: (config) => {
    const errors: string[] = [];
    
    // Business rule: Production must have caching enabled
    if (process.env.NODE_ENV === 'production' && !config.cache?.enabled) {
      errors.push('Cache must be enabled in production environment');
    }
    
    // Business rule: Enterprise features require security audit
    if (config.enterprise?.enabled && !config.security?.audit?.enabled) {
      errors.push('Enterprise mode requires security audit logging');
    }
    
    return errors;
  },
  
  // Rest of configuration...
});
```

## Error Messages & Troubleshooting

### Common Configuration Errors

#### Template Directory Not Found

```
✗ Configuration Error: Templates directory '_templates' does not exist

Solution:
1. Create the templates directory: mkdir _templates
2. Or update templatesDir in your config file
3. Or run 'unjucks init' to set up the project
```

#### Invalid File Permissions

```
✗ Configuration Error: File mode '0999' is invalid

Solution:
1. Use octal notation: 0644 or 0755
2. Use string notation: '644' or '755'
3. Check that permissions are valid Unix file modes
```

#### Memory Limit Too Low

```
✗ Performance Warning: maxMemoryUsage (32 MB) is below recommended minimum

Recommendation:
1. Increase to at least 64 MB for basic usage
2. Use 256+ MB for large projects
3. Monitor actual usage with --verbose flag
```

### Configuration Debugging

Enable debug mode to troubleshoot configuration issues:

```bash
# Debug configuration loading
DEBUG_UNJUCKS=true unjucks generate component react Button

# Show resolved configuration
unjucks --verbose --dry generate component react Button

# Validate configuration only
unjucks config validate
```

This comprehensive reference should help you configure Unjucks for any use case, from simple projects to enterprise deployments.