# Dark-Matter Provenance Integration Guide

## Overview

The Unified Provenance System implements "dark-matter" principles for supply chain transparency:
- **No central database dependency** - All provenance data lives in Git or sidecars
- **Self-contained artifacts** - Each artifact ships with `.attest.json` sidecar
- **Git-first storage** - Uses git-notes for distributed provenance storage
- **"git show + verify" workflow** - Complete verification using only Git commands

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  .attest.json   │    │   Git Notes     │    │ Supply Chain    │
│   Sidecars      │◄──►│   Provenance    │◄──►│ Visualization   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Content         │    │ Git Operations  │    │ Verification    │
│ Addressing      │◄──►│ & Blob Storage  │◄──►│ Commands        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Initialize Unified Provenance System

```javascript
import { UnifiedProvenanceSystem } from '@kgen/core/provenance/unified-provenance.js';

const provenance = new UnifiedProvenanceSystem({
  enableGitFirst: true,
  noCentralDatabase: true,
  requireSidecars: true,
  enableContentAddressing: true
});

await provenance.initialize();
```

### 2. Track Artifact Generation

```javascript
const result = await provenance.trackGeneration({
  artifactPath: './src/generated/api.js',
  templatePath: './templates/api/server.js.njk',
  templateContent: await fs.readFile('./templates/api/server.js.njk', 'utf8'),
  contextData: {
    serviceName: 'UserService',
    endpoints: ['GET /users', 'POST /users']
  },
  metadata: {
    operationId: 'user-api-generation',
    agent: 'kgen-unified'
  }
});

// Result includes:
// - .attest.json sidecar file
// - git-notes provenance storage
// - supply chain graph update
```

### 3. Verify Artifact Integrity

```javascript
const verification = await provenance.verifyArtifact('./src/generated/api.js');

if (verification.overall.verified) {
  console.log('✅ Artifact verified with', verification.overall.confidence * 100, '% confidence');
} else {
  console.log('❌ Verification failed:', verification.overall.issues);
}
```

## Command Line Interface

### Verify Single Artifact

```bash
# Basic verification
kgen provenance verify ./src/generated/api.js

# Detailed verification with git commands
kgen provenance verify ./src/generated/api.js --git-show --verbose

# Supply chain verification
kgen provenance verify ./src/generated/api.js --supply-chain
```

### Batch Verification

```bash
# Verify all artifacts in directory
kgen provenance verify all ./src/generated

# Parallel verification with fail-fast
kgen provenance verify all ./src/generated --parallel --fail-fast

# Generate detailed report
kgen provenance verify all ./src/generated --output-report ./verification-report.md
```

### Supply Chain Analysis

```bash
# Trace artifact lineage
kgen provenance supply-chain trace ./src/generated/api.js

# Generate visualization
kgen provenance supply-chain visualize ./src/generated --format=html --open-browser

# Comprehensive supply chain verification
kgen provenance supply-chain verify-all ./src/generated

# Export supply chain data
kgen provenance supply-chain export ./src/generated --format=sbom --output-file=sbom.json
```

### Manual Verification Commands

```bash
# Get git commands for manual verification
kgen provenance verify git-commands ./src/generated/api.js

# Example output:
# 🔍 Git Show Commands:
#   git notes --ref=refs/notes/kgen-provenance show a1b2c3d4...
#   git show e5f6g7h8...  # template blob
#   git show i9j0k1l2...  # context blob
#
# ✅ Local Verification Commands:
#   cat ./src/generated/api.js.attest.json | jq .
#   sha256sum ./src/generated/api.js
#   kgen verify ./src/generated/api.js
```

## .attest.json Sidecar Format

The unified `.attest.json` format combines the best of existing formats:

```json
{
  "$schema": "https://kgen.org/schemas/attestation-v1.1.json",
  "version": "1.1.0",
  "unified": true,
  "darkMatter": true,
  
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T10:30:00.000Z",
  
  "artifact": {
    "path": "./src/generated/api.js",
    "name": "api.js",
    "contentHash": "f516d572a293d84fbfe627bd61128798ec7cec382e830e8c23b6332b688c8b02",
    "size": 2048,
    "mimeType": "application/javascript",
    "contentAddressing": {
      "enabled": true,
      "gitSha": "a1b2c3d4e5f6789012345678901234567890abcd"
    }
  },
  
  "generation": {
    "templatePath": "./templates/api/server.js.njk",
    "templateHash": "e5f6g7h8i9j012345678901234567890abcdef12",
    "contextHash": "i9j0k1l2m3n456789012345678901234567890cdef",
    "context": {
      "serviceName": "UserService",
      "endpoints": ["GET /users", "POST /users"]
    },
    "generatedAt": "2025-01-15T10:30:00.000Z",
    "operationId": "user-api-generation",
    "agent": "kgen-unified"
  },
  
  "environment": {
    "generator": {
      "name": "kgen-unified-provenance",
      "version": "2.0.0"
    },
    "nodeVersion": "v20.10.0",
    "platform": "linux",
    "arch": "x64",
    "staticBuildTime": "2025-01-15T10:30:00.000Z"
  },
  
  "provO": {
    "@context": {
      "prov": "http://www.w3.org/ns/prov#",
      "kgen": "http://kgen.org/prov#"
    },
    "@id": "kgen:activity-a1b2c3d4",
    "@type": "prov:Activity",
    "prov:used": [{
      "@type": "prov:Entity",
      "prov:location": "./templates/api/server.js.njk",
      "kgen:templateSha": "e5f6g7h8i9j012345678901234567890abcdef12"
    }],
    "prov:generated": {
      "@type": "prov:Entity",
      "prov:location": "./src/generated/api.js",
      "kgen:artifactSha": "f516d572a293d84fbfe627bd61128798ec7cec382e830e8c23b6332b688c8b02"
    }
  },
  
  "git": {
    "enabled": true,
    "notesRef": "refs/notes/kgen-provenance",
    "contentAddressing": true,
    "repoPath": "/path/to/project"
  },
  
  "verification": {
    "reproducible": true,
    "deterministic": true,
    "algorithm": "sha256",
    "darkMatterCompliant": true,
    "supplyChainTraceable": true
  },
  
  "signature": {
    "algorithm": "sha256",
    "value": "6daff6bbbc56c9d616941a1473c8a0d0908af52a69e2bfa00d69702c3dfc42bf"
  }
}
```

## Git-Notes Provenance Storage

Git-notes provide distributed, versioned provenance storage:

```bash
# View provenance for artifact
git notes --ref=refs/notes/kgen-provenance show <artifact-sha>

# List all tracked artifacts
git notes --ref=refs/notes/kgen-provenance list

# Export git-notes provenance
git notes --ref=refs/notes/kgen-provenance show --format="%N" <artifact-sha>
```

Example git-notes content (PROV-O compliant):

```json
{
  "@context": {
    "prov": "http://www.w3.org/ns/prov#",
    "kgen": "http://kgen.org/prov#"
  },
  "@id": "kgen:activity-user-api-generation",
  "@type": "prov:Activity",
  "prov:used": [
    {
      "@type": "prov:Entity",
      "kgen:blobSha": "e5f6g7h8...",
      "kgen:path": "./templates/api/server.js.njk",
      "kgen:role": "template"
    },
    {
      "@type": "prov:Entity", 
      "kgen:blobSha": "i9j0k1l2...",
      "kgen:role": "context"
    }
  ],
  "prov:generated": {
    "@type": "prov:Entity",
    "kgen:blobSha": "a1b2c3d4...",
    "kgen:path": "./src/generated/api.js"
  },
  "kgen:integrity": {
    "kgen:templateHash": "e5f6g7h8...",
    "kgen:contextHash": "i9j0k1l2...",
    "kgen:outputHash": "a1b2c3d4...",
    "kgen:chainHash": "m3n4o5p6..."
  }
}
```

## Supply Chain Visualization

### Generate Interactive HTML Visualization

```javascript
const visualization = await provenance.generateSupplyChainVisualization();

// Outputs:
// - nodes: artifacts and templates
// - edges: generation and dependency relationships
// - statistics: metrics and health indicators
```

### Command Line Visualization

```bash
# Generate DOT graph for Graphviz
kgen provenance supply-chain visualize ./src --format=dot > supply-chain.dot
dot -Tsvg supply-chain.dot -o supply-chain.svg

# Generate Mermaid diagram
kgen provenance supply-chain visualize ./src --format=mermaid > supply-chain.mmd

# Generate interactive HTML
kgen provenance supply-chain visualize ./src --format=html --output-file=supply-chain.html
```

### Supply Chain Metrics

```bash
kgen provenance supply-chain analyze ./src

# Output:
# 📊 Supply Chain Analysis
# 
# 📁 Directory: ./src
# 📅 Analyzed: 2025-01-15T10:30:00.000Z
# 
# 📈 Metrics:
#   Total Artifacts: 25
#   Template Families: 3
#   Families: api-server, web-client, database-schema
# 
# 🏥 Health Assessment:
#   Overall: 🟢 EXCELLENT
#   Verification Rate: 96.0%
#   Integrity Score: 96.0%
```

## Migration Guide

### Migrate Existing .attest.json Files

```bash
# Dry run to see what would be migrated
kgen provenance migrate --dry-run

# Migrate with backups
kgen provenance migrate --create-backups

# Migrate and create git-notes entries
kgen provenance migrate --enable-git-notes
```

### Programmatic Migration

```javascript
const migration = await provenance.migrateExistingAttestations({
  createBackups: true,
  dryRun: false
});

console.log(`Migrated ${migration.migratedFiles} files`);
console.log(`Created ${migration.gitNotesCreated} git-notes entries`);
```

## Integration Examples

### With Build Systems

#### Webpack Plugin

```javascript
class KgenProvenancePlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync('KgenProvenancePlugin', async (compilation, callback) => {
      const provenance = new UnifiedProvenanceSystem();
      await provenance.initialize();
      
      for (const [filename, asset] of Object.entries(compilation.assets)) {
        await provenance.trackGeneration({
          artifactPath: path.join(compiler.options.output.path, filename),
          templatePath: 'webpack-build',
          contextData: {
            entryPoints: Object.keys(compiler.options.entry),
            mode: compiler.options.mode
          }
        });
      }
      
      callback();
    });
  }
}
```

#### NPM Scripts

```json
{
  "scripts": {
    "build": "webpack && kgen provenance verify all ./dist",
    "verify": "kgen provenance supply-chain verify-all ./dist",
    "trace": "kgen provenance supply-chain trace"
  }
}
```

### With CI/CD Pipelines

#### GitHub Actions

```yaml
name: Supply Chain Verification

on: [push, pull_request]

jobs:
  verify-supply-chain:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install KGEN
        run: npm install -g @kgen/cli
        
      - name: Verify Supply Chain
        run: |
          kgen provenance supply-chain verify-all ./src
          kgen provenance supply-chain analyze ./src --output-format=json > supply-chain-report.json
          
      - name: Upload Supply Chain Report
        uses: actions/upload-artifact@v3
        with:
          name: supply-chain-report
          path: supply-chain-report.json
```

#### Docker Integration

```dockerfile
# Multi-stage build with provenance verification
FROM node:18 AS builder
COPY . /app
WORKDIR /app
RUN npm install && npm run build

# Verify generated artifacts
RUN npx kgen provenance verify all ./dist
RUN npx kgen provenance supply-chain export ./dist --format=sbom --output-file=sbom.json

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/sbom.json /usr/share/nginx/html/.well-known/sbom.json
```

## Best Practices

### 1. Always Generate Sidecars

```javascript
// ✅ Good - Always track generation
const result = await provenance.trackGeneration({
  artifactPath: outputPath,
  templatePath: templatePath,
  templateContent: templateContent,
  contextData: context
});

// ❌ Bad - Generate artifacts without provenance
await fs.writeFile(outputPath, generatedContent);
```

### 2. Verify Before Distribution

```javascript
// ✅ Good - Verify before publishing
const verification = await provenance.verifyArtifact(artifactPath);
if (!verification.overall.verified) {
  throw new Error(`Artifact verification failed: ${verification.overall.issues.join(', ')}`);
}
await publishArtifact(artifactPath);
```

### 3. Include in Version Control

```bash
# ✅ Good - Track sidecars in Git
git add src/generated/api.js src/generated/api.js.attest.json
git commit -m "Add generated API with provenance"

# Git-notes are automatically synced
git push origin main
git push origin refs/notes/kgen-provenance
```

### 4. Regular Supply Chain Audits

```bash
# Run weekly supply chain health checks
kgen provenance supply-chain analyze ./src --include-risk --include-performance
kgen provenance supply-chain verify-all ./src --output-report=weekly-audit.md
```

### 5. Export for Compliance

```bash
# Generate SBOM for regulatory compliance
kgen provenance supply-chain export ./src --format=sbom --sbom-format=spdx --output-file=sbom-spdx.json
kgen provenance supply-chain export ./src --format=sbom --sbom-format=cyclonedx --output-file=sbom-cyclonedx.json
```

## Troubleshooting

### Common Issues

#### 1. Git Repository Not Initialized

```bash
Error: Git repository not found

# Solution:
git init
git add .
git commit -m "Initial commit"
```

#### 2. Missing .attest.json Sidecars

```bash
# Check for missing sidecars
find . -name "*.js" ! -name "*.attest.json" -exec test ! -f {}.attest.json \; -print

# Generate missing attestations
kgen generate-attestations ./src --missing-only
```

#### 3. Git Notes Synchronization

```bash
# Push git notes to remote
git push origin refs/notes/kgen-provenance

# Pull git notes from remote  
git fetch origin refs/notes/kgen-provenance:refs/notes/kgen-provenance
```

#### 4. Performance Issues with Large Repositories

```javascript
// Use streaming for large operations
const provenance = new UnifiedProvenanceSystem({
  enableStreaming: true,
  batchSize: 100,
  enableCaching: true
});
```

### Debug Mode

```bash
# Enable verbose logging
export DEBUG=kgen:provenance:*
kgen provenance verify ./artifact.js

# Or programmatically
import consola from 'consola';
consola.level = 4; // Verbose
```

## API Reference

### UnifiedProvenanceSystem Class

```javascript
class UnifiedProvenanceSystem {
  constructor(options: {
    enableGitFirst?: boolean;
    requireSidecars?: boolean;
    noCentralDatabase?: boolean;
    enableContentAddressing?: boolean;
    gitRepoPath?: string;
    notesRef?: string;
  });

  async initialize(): Promise<InitResult>;
  
  async trackGeneration(data: GenerationData): Promise<TrackingResult>;
  
  async verifyArtifact(artifactPath: string, options?: VerifyOptions): Promise<VerificationResult>;
  
  async getProvenance(artifactPath: string): Promise<ProvenanceData>;
  
  async generateSupplyChainVisualization(): Promise<VisualizationData>;
  
  async createVerificationCommand(artifactPath: string): Promise<CommandResult>;
  
  async migrateExistingAttestations(options?: MigrationOptions): Promise<MigrationResult>;
}
```

### CLI Commands

```bash
kgen provenance verify <artifact> [options]
kgen provenance verify all <directory> [options]
kgen provenance verify git-commands <artifact>
kgen provenance verify explain <artifact>

kgen provenance supply-chain trace <artifact> [options]
kgen provenance supply-chain visualize <directory> [options]
kgen provenance supply-chain verify-all <directory> [options]
kgen provenance supply-chain analyze <directory> [options]
kgen provenance supply-chain export <directory> [options]
```

## Contributing

The unified provenance system is designed to be extensible:

1. **Custom Verification Rules** - Add domain-specific verification logic
2. **Additional Storage Backends** - Implement alternative storage providers
3. **Visualization Formats** - Add new visualization output formats
4. **Integration Plugins** - Create plugins for build tools and IDEs

See the [Contributing Guide](../CONTRIBUTING.md) for development setup and contribution guidelines.

## Security Considerations

1. **Content Addressing** - All artifacts are content-addressed using SHA-256
2. **Cryptographic Signatures** - Sidecars include tamper-evident signatures
3. **Git Security** - Relies on Git's cryptographic integrity guarantees
4. **No External Dependencies** - Dark-matter principle eliminates SaaS dependencies
5. **Distributed Verification** - Anyone with Git access can verify supply chain

## License

This implementation is part of the KGEN project and follows the same licensing terms.