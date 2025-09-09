# Enterprise Configuration Management Guide

## Overview

The Unjucks enterprise configuration system provides robust, environment-aware configuration management with support for:

- **Environment-based configurations** (development, staging, production)
- **Feature flags** with gradual rollouts and user targeting
- **Secrets management** (Vault, AWS Secrets Manager, Azure Key Vault)
- **Hot-reload** capabilities for safe runtime configuration updates
- **Schema validation** with proper typing
- **Configuration inheritance** and overrides

## Architecture

### Configuration Manager

The `ConfigManager` class is the central orchestrator that:
- Loads configurations from multiple sources
- Validates against schemas
- Manages secrets and feature flags
- Handles hot-reload functionality
- Provides a unified API for configuration access

### Configuration Sources (Order of Precedence)

1. **Base Configuration** (`config/default.js`)
2. **Environment Configuration** (`config/environments/{env}.json`)
3. **Local Overrides** (`config/local.js` - gitignored)
4. **Runtime Configuration** (`config/runtime.json`)
5. **Environment Variables** (`CONFIG_*`)

### File Structure

```
config/
├── default.js                    # Base configuration
├── schemas/
│   └── config-schema.js          # Zod validation schemas
├── manager/
│   ├── config-manager.js         # Main configuration manager
│   ├── secrets-manager.js        # Secrets management
│   └── feature-flags-manager.js  # Feature flags management
├── hot-reload/
│   └── hot-reload-handler.js     # Hot reload functionality
├── environments/
│   ├── development.json          # Development environment
│   ├── staging.json              # Staging environment
│   └── production.json           # Production environment
└── local.js                      # Local overrides (gitignored)
```

## Quick Start

### 1. Initialize Configuration Manager

```javascript
import { initializeConfig, getConfig, isFeatureEnabled } from './config/manager/config-manager.js';

// Initialize with options
const configManager = await initializeConfig({
  configDir: './config',
  environment: process.env.NODE_ENV || 'development',
  enableHotReload: process.env.NODE_ENV !== 'production',
  enableValidation: true,
  enableSecrets: true,
  enableFeatureFlags: true
});

// Access configuration
const serverPort = getConfig('server.port', 3000);
const dbConfig = getConfig('database');

// Check feature flags
if (isFeatureEnabled('unjucks.templates.cache')) {
  // Enable template caching
}
```

### 2. Environment Variables

Override any configuration using environment variables with the `CONFIG_` prefix:

```bash
# Override server port
export CONFIG_server__port=8080

# Override database configuration
export CONFIG_database__host=localhost
export CONFIG_database__pool__max=20

# Override feature flags
export CONFIG_features__flags__unjucks.validation.strict=true
```

## Configuration Schemas

All configurations are validated using Zod schemas for type safety and consistency:

```javascript
import { ConfigSchema, validateEnvironmentConfig } from './config/schemas/config-schema.js';

// Validate configuration
const validConfig = ConfigSchema.parse(rawConfig);

// Environment-specific validation
const prodConfig = validateEnvironmentConfig(config, 'production');
```

### Key Schema Features

- **Type Safety**: All configuration values are properly typed
- **Default Values**: Sensible defaults for all settings
- **Validation Rules**: Min/max values, required fields, format validation
- **Environment Checks**: Production-specific security requirements

## Feature Flags

### Basic Usage

```javascript
// Check if a feature is enabled
if (isFeatureEnabled('unjucks.generators.parallel')) {
  // Use parallel generation
}

// Get feature value (supports non-boolean values)
const maxConcurrency = configManager.getValue('unjucks.generators.maxConcurrency', 4);
```

### Rollout Configuration

Feature flags support sophisticated rollout strategies:

```javascript
// In your configuration
features: {
  flags: {
    'new-feature': false  // Base value
  },
  rollouts: {
    'new-feature': {
      enabled: true,
      percentage: 25,           // 25% rollout
      userGroups: ['beta'],     // Target beta users
      userIds: ['user-123'],    // Target specific users
      conditions: [
        {
          attribute: 'environment',
          operator: 'eq',
          value: 'staging'
        }
      ]
    }
  }
}

// Usage with context
const context = {
  userId: 'user-456',
  userGroup: 'beta',
  environment: 'staging'
};

if (configManager.isFeatureEnabled('new-feature', context)) {
  // Feature is enabled for this user/context
}
```

### Supported Rollout Operators

- `eq` - Equal to
- `ne` - Not equal to  
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `in` - In array
- `not_in` - Not in array
- `contains` - String contains
- `starts_with` - String starts with
- `ends_with` - String ends with
- `regex` - Regular expression match

## Secrets Management

### Supported Providers

1. **Environment Variables** (default)
2. **HashiCorp Vault**
3. **AWS Secrets Manager**
4. **Azure Key Vault**

### Basic Usage

```javascript
// Get a secret
const dbPassword = await configManager.getSecret('DB_PASSWORD');

// Get multiple secrets
const secrets = await configManager.getSecrets(['DB_PASSWORD', 'JWT_SECRET']);
```

### Vault Configuration

```javascript
secrets: {
  provider: 'vault',
  vault: {
    endpoint: 'https://vault.company.com:8200',
    token: process.env.VAULT_TOKEN,
    // Or use AppRole authentication
    roleId: process.env.VAULT_ROLE_ID,
    secretId: process.env.VAULT_SECRET_ID,
    mount: 'secret',
    version: 'v2'
  },
  caching: {
    enabled: true,
    ttl: 900  // 15 minutes
  }
}
```

### AWS Secrets Manager Configuration

```javascript
secrets: {
  provider: 'aws-secrets-manager',
  aws: {
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
}
```

## Hot Reload

Hot reload allows safe runtime configuration updates without application restarts.

### Configuration

```javascript
hotReload: {
  enabled: true,
  watchPaths: ['./config'],
  excludePaths: ['./config/secrets', './config/runtime.json'],
  debounceMs: 1000,
  restartOnChange: ['server', 'database', 'security'],  // Requires restart
  safeReload: ['logging', 'monitoring', 'features']     // Can hot reload
}
```

### Reload Strategies

1. **Safe Reload**: Updates logging, monitoring, and feature flags without restart
2. **Restart Required**: Critical changes (server, database, security) trigger restart events
3. **Validation Only**: Changes are validated but require manual restart

### Event Handling

```javascript
configManager.on('configChanged', (change) => {
  console.log('Configuration changed:', change);
});

configManager.on('restartRequired', (info) => {
  console.log('Application restart required:', info);
  process.exit(0); // Graceful shutdown
});

configManager.on('safeReload', (section) => {
  console.log('Safe reload completed:', section);
});
```

## Environment-Specific Configurations

### Development Environment

```json
{
  "app": {
    "environment": "development"
  },
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "security": {
    "headers": {
      "hsts": false
    },
    "rateLimit": {
      "enabled": false
    }
  },
  "logging": {
    "level": "debug",
    "format": "pretty"
  }
}
```

### Production Environment

```json
{
  "app": {
    "environment": "production"
  },
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "security": {
    "headers": {
      "hsts": true,
      "contentSecurityPolicy": true
    },
    "rateLimit": {
      "enabled": true,
      "maxRequests": 1000,
      "windowMs": 900000
    }
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

## Configuration Patterns

### Database Configuration

```javascript
database: {
  type: 'postgresql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'unjucks_db',
  username: process.env.DB_USER || 'postgres',
  // Password retrieved from secrets manager
  ssl: process.env.NODE_ENV === 'production',
  pool: {
    min: 2,
    max: process.env.NODE_ENV === 'production' ? 20 : 10
  }
}
```

### CORS Configuration

```javascript
security: {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://app.company.com']
      : ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
}
```

### Logging Configuration

```javascript
logging: {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
  enableAudit: true,
  enablePerformance: process.env.NODE_ENV === 'production',
  transports: process.env.NODE_ENV === 'production' 
    ? ['console', 'file', 'elasticsearch'] 
    : ['console']
}
```

## Monitoring and Health Checks

### Configuration Health Check

```javascript
const health = await configManager.healthCheck();
console.log('Configuration health:', health);
```

### Health Check Response

```javascript
{
  status: 'healthy',
  timestamp: '2024-01-01T00:00:00.000Z',
  environment: 'production',
  configLoaded: true,
  secretsManager: {
    status: 'healthy',
    provider: 'vault'
  },
  featureFlagsManager: {
    status: 'healthy',
    flagsCount: 15
  },
  hotReload: true,
  watchedFiles: ['./config/environments/production.json']
}
```

## Best Practices

### 1. Configuration Organization

- Use environment-specific files for environment differences
- Keep secrets in a dedicated secrets management system
- Use feature flags for gradual rollouts
- Document all configuration options

### 2. Security

- Never commit secrets to version control
- Use strong encryption for sensitive data
- Implement proper access controls for configuration files
- Enable HSTS and CSP in production

### 3. Validation

- Always validate configuration on startup
- Use schema validation for type safety
- Implement environment-specific validation rules
- Test configuration changes in staging first

### 4. Hot Reload

- Only enable hot reload in non-production environments
- Use safe reload for non-critical settings
- Always backup configuration before changes
- Monitor configuration change events

### 5. Feature Flags

- Start with percentage rollouts for new features
- Use user targeting for beta testing
- Monitor feature flag usage and performance
- Clean up unused feature flags regularly

## API Reference

### ConfigManager Methods

```javascript
// Configuration access
const value = configManager.get('path.to.config', defaultValue);
configManager.set('path.to.config', newValue);

// Feature flags
const enabled = configManager.isFeatureEnabled('feature-name', context);

// Secrets
const secret = await configManager.getSecret('SECRET_NAME');

// Health check
const health = await configManager.healthCheck();

// Export/import
const config = configManager.export(includeSensitive);

// Cleanup
configManager.destroy();
```

### Events

```javascript
// Configuration events
configManager.on('initialized', (config) => {});
configManager.on('changed', (path, value) => {});
configManager.on('configChanged', (change) => {});
configManager.on('restartRequired', (section) => {});
configManager.on('safeReload', (section) => {});
configManager.on('reloadError', (error) => {});

// Feature flag events
featureFlagsManager.on('flagsUpdated', (flags) => {});
featureFlagsManager.on('flagChanged', (change) => {});
```

## Troubleshooting

### Common Issues

1. **Configuration not loading**
   - Check file permissions
   - Verify file syntax (JSON/JS)
   - Check environment variable `NODE_ENV`

2. **Secrets not accessible**
   - Verify provider configuration
   - Check authentication credentials
   - Test network connectivity

3. **Feature flags not working**
   - Verify feature flag configuration
   - Check rollout conditions
   - Enable debug logging

4. **Hot reload not working**
   - Check file watcher permissions
   - Verify paths are not excluded
   - Check debounce timing

### Debug Logging

Enable debug logging to troubleshoot issues:

```javascript
// Set log level to debug
process.env.LOG_LEVEL = 'debug';

// Or in configuration
logging: {
  level: 'debug'
}
```

### Health Check Endpoints

Add health check endpoints to monitor configuration:

```javascript
app.get('/health/config', async (req, res) => {
  const health = await configManager.healthCheck();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

## Migration Guide

### From Simple Configuration

If migrating from a simple configuration setup:

1. Move existing configuration to `config/default.js`
2. Split environment-specific settings to `config/environments/`
3. Add schema validation
4. Implement secrets management
5. Add feature flags for new features

### From Other Configuration Systems

When migrating from other systems:

1. Map existing configuration structure to new schema
2. Create migration scripts for environment files
3. Test validation with existing configurations
4. Gradually adopt new features (secrets, feature flags)
5. Update deployment scripts for new configuration loading

This enterprise configuration management system provides a robust, secure, and flexible foundation for managing complex application configurations across multiple environments.