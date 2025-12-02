# Git-First Config and Lock Semantics

KGEN implements a git-first approach to configuration and lock file management, providing deterministic builds, drift detection, and seamless version control integration.

## Overview

The git-first system consists of four main components:

1. **Config Loader** - Single source of truth configuration resolution
2. **Lock Manager** - Deterministic lock file generation and management
3. **Drift Detector** - Baseline comparison and change analysis
4. **Git Integration** - Version control tracking and automation

## Configuration Resolution

### Project Root Only (No Cascading)

KGEN follows a **single source of truth** principle for configuration:

```javascript
// ✅ CORRECT: Single config file at project root
project-root/
├── kgen.config.js          // Single source of truth
├── templates/
└── dist/

// ❌ WRONG: No cascading from parent directories
parent/
├── kgen.config.js          // This will NOT be inherited
└── child/
    └── my-project/         // Must have own config
```

### Configuration File Priority

KGEN searches for configuration files in this order:

1. `kgen.config.js` (ESM modules)
2. `kgen.config.mjs` (ESM modules)
3. `kgen.config.json` (JSON format)
4. `.kgenrc.js` (ESM modules)
5. `.kgenrc.json` (JSON format)

### Environment-Aware Configuration

```javascript
// kgen.config.js
export default {
  directories: {
    out: './dist',
    cache: './.kgen/cache'
  },
  
  // Base configuration
  cache: { enabled: true },
  
  // Environment-specific overrides
  environments: {
    development: {
      cache: { enabled: false },
      dev: { debug: true, verbose: true }
    },
    
    production: {
      generate: { parallel: true, maxConcurrency: 8 },
      cache: { maxSize: '1GB', ttl: 7200000 },
      security: { sandbox: true }
    },
    
    test: {
      directories: { out: './test-output' },
      cache: { enabled: false },
      metrics: { enabled: false }
    }
  }
};
```

## Lock File Semantics

### Generation-Only Updates

Lock files are updated **only on successful generation** - never through user prompts:

```bash
# ✅ CORRECT: Update lock on successful generation
kgen generate api-service --template enterprise
# → Updates kgen.lock.json automatically

# ✅ CORRECT: Explicit lock file generation
kgen lock generate
# → Updates kgen.lock.json with current state

# ❌ WRONG: No user prompts for lock updates
# No "Do you want to update lock file? (y/n)" prompts
```

### Deterministic Lock Format

```json
{
  "version": "2.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "project": {
    "name": "my-project",
    "version": "1.0.0",
    "root": "/path/to/project"
  },
  "git": {
    "commit": "abc123def456",
    "branch": "main",
    "dirty": false,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "templates": {
    "templates/api.njk": {
      "hash": "sha256:...",
      "size": 1024,
      "modified": "2024-01-01T00:00:00.000Z"
    }
  },
  "rules": {
    "rules/validation.n3": {
      "hash": "sha256:...",
      "size": 2048,
      "modified": "2024-01-01T00:00:00.000Z"
    }
  },
  "integrity": {
    "combined": "sha256:...",
    "components": {
      "templates": "sha256:...",
      "rules": "sha256:...",
      "graphs": "sha256:..."
    }
  }
}
```

## Drift Detection

### Baseline Comparison

Drift detection uses the lock file as the source of truth:

```bash
# Check for drift against lock file baseline
kgen drift check

# Detailed drift analysis with recommendations
kgen drift check --verbose --details

# Check specific file categories
kgen drift check --templates --rules
```

### Drift Types and Severity

```javascript
// Drift types with automatic severity assignment
const DRIFT_TYPES = {
  TEMPLATE_ADDED: 'template-added',      // INFO
  TEMPLATE_REMOVED: 'template-removed',  // WARNING
  TEMPLATE_MODIFIED: 'template-modified', // WARNING
  RULE_ADDED: 'rule-added',              // INFO
  RULE_REMOVED: 'rule-removed',          // ERROR
  RULE_MODIFIED: 'rule-modified',        // WARNING
  CONFIG_CHANGED: 'config-changed',      // WARNING
  SEMANTIC_INCONSISTENCY: 'semantic-inconsistency' // ERROR
};
```

### Semantic-Aware Analysis

```bash
# Enable semantic analysis for RDF/Turtle files
kgen drift check --semantic

# Example semantic drift detection
# Detects:
# - Ontology structure changes
# - SHACL validation rule modifications
# - Large RDF modifications
# - Reasoning rule dependencies
```

## Git Integration

### Automatic Tracking

```bash
# Setup Git integration
kgen git setup

# Track configuration files
kgen git track

# Commit configuration changes
kgen git commit "Update API templates"
```

### Git Hooks Integration

```bash
# Install Git hooks for automatic validation
kgen git hooks install

# Pre-commit hook validates:
# - Configuration syntax
# - Lock file drift
# - Template consistency

# Post-merge hook checks:
# - Configuration changes
# - Lock file updates needed
```

## Usage Examples

### Basic Project Setup

```bash
# 1. Initialize project with configuration
echo 'export default { directories: { out: "./dist" } };' > kgen.config.js

# 2. Generate initial lock file
kgen lock generate

# 3. Setup Git integration
kgen git setup
kgen git track
git commit -m "Initial KGEN configuration"
```

### Development Workflow

```bash
# 1. Make changes to templates/rules
vim templates/api-service.njk
vim rules/validation.n3

# 2. Check for drift
kgen drift check --verbose

# 3. Generate artifacts (updates lock automatically)
kgen generate api-service

# 4. Commit changes
kgen git commit "Update API service template"
```

### Production Deployment

```bash
# 1. Verify no drift in production
kgen drift check --strict

# 2. Generate with production config
NODE_ENV=production kgen generate --all

# 3. Validate generated artifacts
kgen validate --output ./dist

# 4. Update lock file if needed
kgen lock generate
```

### Multi-Environment Management

```javascript
// kgen.config.js - Environment-specific configuration
export default {
  directories: {
    out: './dist',
    templates: './templates'
  },
  
  environments: {
    development: {
      generate: { parallel: false },
      dev: { debug: true }
    },
    
    staging: {
      generate: { parallel: true, maxConcurrency: 4 },
      cache: { enabled: true }
    },
    
    production: {
      generate: { parallel: true, maxConcurrency: 8 },
      cache: { enabled: true, maxSize: '1GB' },
      security: { sandbox: true },
      provenance: { signing: { enabled: true } }
    }
  }
};
```

```bash
# Deploy to different environments
NODE_ENV=development kgen generate
NODE_ENV=staging kgen generate
NODE_ENV=production kgen generate
```

## API Reference

### ConfigLoader

```javascript
import { ConfigLoader, loadConfig } from '@kgen/config';

// Create loader instance
const loader = new ConfigLoader({
  cwd: '/path/to/project',
  env: 'production'
});

// Load configuration
const config = await loader.load();

// Validate configuration
const validation = loader.validate(config);

// Convenience function
const config = await loadConfig({ env: 'test' });
```

### LockManager

```javascript
import { LockManager, generateLockFile } from '@kgen/config';

// Create manager instance
const manager = new LockManager({
  projectRoot: '/path/to/project',
  lockPath: './custom.lock.json'
});

// Generate lock file
const lockFile = await manager.generate({ config });

// Update lock file
await manager.update(lockFile, { backup: true });

// Load existing lock file
const existing = await manager.load();

// Compare current state with lock
const comparison = await manager.compare();
```

### DriftDetector

```javascript
import { DriftDetector, detectDrift } from '@kgen/config';

// Create detector instance
const detector = new DriftDetector({
  projectRoot: '/path/to/project',
  semanticAnalysis: true
});

// Detect drift
const result = await detector.detect({
  details: true,
  artifacts: true
});

// Generate report
const report = detector.generateReport(result, {
  format: 'json',
  verbose: true
});

// Convenience function
const drift = await detectDrift({ semanticAnalysis: false });
```

### GitIntegration

```javascript
import { GitIntegration, getGitStatus } from '@kgen/config';

// Create integration instance
const git = new GitIntegration({
  projectRoot: '/path/to/project'
});

// Get Git status
const status = await git.getStatus();

// Track configuration files
const result = await git.trackConfigFiles(['custom.config.js']);

// Create commit
const commit = await git.commitConfigChanges('Update config');

// Setup Git hooks
const hooks = await git.setupGitHooks();

// Update .gitignore
const ignore = await git.updateGitIgnore({ force: true });
```

## Best Practices

### Configuration Management

1. **Single Source of Truth**: One config file per project root
2. **Environment Separation**: Use `environments` section for overrides
3. **Path Resolution**: Use relative paths, resolved to absolute automatically
4. **Validation**: Always validate configuration before use
5. **Version Control**: Track config files in Git

### Lock File Management

1. **Automatic Updates**: Let generation update lock files
2. **Version Control**: Always commit lock files
3. **Deterministic Builds**: Use `SOURCE_DATE_EPOCH` for reproducibility
4. **Backup Strategy**: Enable backups for important changes
5. **Regular Validation**: Check drift frequently

### Drift Detection

1. **Baseline Maintenance**: Keep lock files up-to-date
2. **Semantic Analysis**: Enable for RDF/Turtle projects
3. **Impact Assessment**: Review recommendations carefully
4. **Automation**: Integrate into CI/CD pipelines
5. **Documentation**: Document drift resolution procedures

### Git Integration

1. **Hook Installation**: Use pre-commit and post-merge hooks
2. **Ignore Patterns**: Update .gitignore with KGEN patterns
3. **Commit Messages**: Use descriptive messages for config changes
4. **Branch Protection**: Require drift checks in pull requests
5. **History Tracking**: Maintain lock file history for auditing

## Troubleshooting

### Common Issues

```bash
# Configuration not found
Error: No kgen configuration file found in project hierarchy
# Solution: Create kgen.config.js in project root

# Lock file version incompatible
Error: Incompatible lock file version: 3.0.0. Expected: 2.0.0
# Solution: Regenerate lock file with current version

# Drift detected in CI
Error: KGEN drift detected. Please update lock file
# Solution: Run `kgen lock generate` and commit changes

# Git repository not found
Warning: Not a Git repository
# Solution: Initialize Git or run outside Git context
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=kgen:* kgen drift check

# Verbose output
kgen drift check --verbose --details

# Configuration debugging
kgen config show --resolved --metadata
```

### Performance Optimization

```javascript
// Optimize for large projects
export default {
  cache: {
    enabled: true,
    maxSize: '1GB',
    strategy: 'lru'
  },
  
  generate: {
    parallel: true,
    maxConcurrency: require('os').cpus().length
  },
  
  drift: {
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/.git/**'
    ]
  }
};
```

## Migration Guide

### From Legacy Config Systems

```bash
# 1. Create new configuration
kgen config init --from legacy-config.json

# 2. Generate initial lock file
kgen lock generate

# 3. Validate migration
kgen drift check --baseline legacy

# 4. Update build scripts
# Replace legacy commands with kgen equivalents
```

### Version Upgrades

```bash
# 1. Backup existing configuration
cp kgen.config.js kgen.config.js.backup
cp kgen.lock.json kgen.lock.json.backup

# 2. Update configuration format
kgen config migrate --from v1 --to v2

# 3. Regenerate lock file
kgen lock generate --force

# 4. Validate upgrade
kgen validate --config --templates --rules
```

## Integration Examples

### GitHub Actions

```yaml
# .github/workflows/kgen-drift.yml
name: KGEN Drift Check

on:
  pull_request:
    paths:
      - 'templates/**'
      - 'rules/**'
      - 'kgen.config.*'
      - 'kgen.lock.json'

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Check KGEN drift
        run: |
          npm run kgen drift check --strict --verbose
          
      - name: Generate drift report
        if: failure()
        run: |
          npm run kgen drift check --format json > drift-report.json
          
      - name: Upload drift report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: drift-report
          path: drift-report.json
```

### Docker Integration

```dockerfile
# Dockerfile with KGEN drift checking
FROM node:18-alpine

WORKDIR /app

# Copy configuration first for better caching
COPY kgen.config.js kgen.lock.json package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY templates/ ./templates/
COPY rules/ ./rules/

# Check drift before building
RUN npm run kgen drift check --strict

# Generate artifacts
RUN npm run kgen generate --all

# Validate output
RUN npm run kgen validate --output ./dist

EXPOSE 3000
CMD ["npm", "start"]
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
set -e

echo "KGEN: Validating configuration and checking drift..."

# Check configuration syntax
if ! npx kgen config validate; then
  echo "❌ Configuration validation failed"
  exit 1
fi

# Check for drift
if ! npx kgen drift check --quiet; then
  echo "❌ Drift detected. Please run 'npx kgen lock generate' and commit changes."
  exit 1
fi

echo "✅ KGEN validation passed"
```

## Conclusion

The git-first config and lock semantics provide a robust foundation for:

- **Deterministic Builds**: Reproducible artifact generation
- **Change Tracking**: Comprehensive drift detection and analysis
- **Version Control**: Seamless Git integration and automation
- **Configuration Management**: Single source of truth with environment awareness
- **Production Safety**: Strict validation and semantic analysis

This system ensures that your KGEN projects maintain consistency, traceability, and reliability across all environments and team members.
