# Unjucks Configuration System

## Overview

The Unjucks v3 configuration system provides comprehensive configuration management using c12/confbox with Zod validation, environment-specific overrides, and TypeScript type safety.

## Features

- **c12-based Configuration Loading**: Multi-source configuration loading from files, environment variables, and package.json
- **Zod Schema Validation**: Type-safe configuration with runtime validation
- **Environment-specific Configuration**: Development, production, and test environment overrides
- **Memory Storage**: Configuration schema stored in memory for runtime access
- **Error Handling**: Detailed validation errors and graceful fallbacks
- **TypeScript Support**: Full type safety with JSDoc annotations

## Architecture

```
Configuration Sources → c12 Loader → Zod Validation → App Integration
                                         ↓
                                  Memory Storage (hive/config/system)
```

## Configuration Schema

The configuration is organized into logical sections:

### Core Settings
- `projectRoot`: Project root directory
- `templateDirs`: Template directories with priorities
- `outputDir`: Output directory for generated files
- `environment`: Runtime environment (development/production/test)

### Component Configurations
- `security`: Authentication, rate limiting, CORS settings
- `performance`: Caching, concurrency, memory limits
- `semantic`: RDF/semantic web features
- `templateEngine`: Nunjucks engine settings
- `cli`: Command-line interface configuration
- `fileOps`: File operation settings
- `plugins`: Plugin system configuration
- `logging`: Logging configuration

## Usage

### Loading Configuration

```javascript
import { loadUnjucksConfig } from './src/core/config.js';

// Load with defaults
const config = await loadUnjucksConfig({
  defaults: { environment: 'development' }
});

// Load with custom config file
const config = await loadUnjucksConfig({
  configFile: 'custom.config',
  cwd: '/path/to/project'
});
```

### App Integration

```javascript
import { UnjucksApp } from './src/core/app.js';

const app = new UnjucksApp({
  defaults: { 
    environment: 'production',
    semantic: { enableRDF: true }
  }
});

await app.initialize();

// Access configuration
const config = app.getConfiguration();
const schema = app.getConfigurationSchema();
```

### Configuration Files

Configuration files are loaded in this order (later sources override earlier ones):

1. **Default values** (from schema)
2. **Environment defaults** (based on NODE_ENV)
3. **Configuration files** (unjucks.config.js, .ts, .json, etc.)
4. **Package.json** (`unjucks` field)
5. **Environment variables** (UNJUCKS_* prefix)
6. **Runtime overrides**

### Example Configuration File

```javascript
// unjucks.config.js
export default {
  templateDirs: [
    { path: '_templates', priority: 90 },
    { path: 'shared-templates', priority: 50 }
  ],
  
  security: {
    enableAuth: false,
    rateLimiting: true
  },
  
  semantic: {
    enableRDF: true,
    defaultNamespaces: {
      ex: 'http://example.org/'
    }
  },
  
  performance: {
    cacheEnabled: true,
    maxConcurrency: 8
  }
};
```

### Environment-Specific Configuration

The system automatically applies environment-specific defaults:

**Development:**
- Hot reload enabled
- Debug mode enabled
- Verbose logging

**Production:**
- Authentication enabled
- Rate limiting enforced
- Optimized caching
- JSON logging

**Test:**
- Caching disabled
- Error-level logging
- Mock data enabled

## Validation

All configuration is validated using Zod schemas:

```javascript
import { validateConfig } from './src/core/config.js';

const result = validateConfig({
  environment: 'development',
  performance: { maxConcurrency: 8 }
});

if (!result.success) {
  console.error('Validation errors:', result.errors);
}
```

## Memory Storage

Configuration schema is automatically stored in memory for runtime access:

```javascript
// Access stored schema
const memoryStore = app.getMemoryStore();
const schema = memoryStore['hive/config/system'];

console.log('Schema version:', schema.version);
console.log('Available components:', Object.keys(schema.components));
```

## Environment Variables

Environment variables with the `UNJUCKS_` prefix are automatically loaded:

```bash
export UNJUCKS_ENVIRONMENT=production
export UNJUCKS_SEMANTIC_ENABLE_RDF=true
export UNJUCKS_PERFORMANCE_MAX_CONCURRENCY=16
```

## Type Safety

The configuration system provides full TypeScript support through Zod schema inference:

```typescript
import type { UnjucksConfig } from './src/core/config.js';

function useConfig(config: UnjucksConfig) {
  // Full type safety
  config.templateDirs.forEach(dir => {
    console.log(dir.path, dir.priority);
  });
}
```

## Error Handling

The system provides detailed error handling:

- **Validation Errors**: Specific field-level validation messages
- **File Loading Errors**: Graceful fallback to defaults
- **Schema Errors**: Clear error messages with suggested fixes

## Performance

- **Lazy Loading**: Components loaded only when needed
- **Caching**: Configuration cached after first load
- **Validation Caching**: Schema validation results cached
- **Memory Efficiency**: Minimal memory footprint

## Testing

Comprehensive test suite covers:
- Schema validation scenarios
- Environment-specific loading
- Error handling and recovery
- App integration
- Memory storage functionality

## Migration from Simple Config

The new configuration system is backward compatible with existing configuration files. To migrate:

1. Update imports from `simple-config.js` to `config.js`
2. Review configuration structure for new features
3. Add Zod validation for custom configuration
4. Utilize new environment-specific features

## Conclusion

The Unjucks v3 configuration system provides a robust, type-safe, and flexible foundation for configuration management that scales from simple projects to complex enterprise applications while maintaining ease of use and comprehensive validation.