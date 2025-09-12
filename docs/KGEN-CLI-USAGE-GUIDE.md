# KGEN CLI Usage Guide

**Knowledge Graph Engine for Deterministic Artifact Generation**  
**Version**: 1.0.8  
**Updated**: September 11, 2025

## Quick Start

```bash
# Install dependencies (required)
npm install c12

# Basic usage
./bin/kgen.mjs --help
./bin/kgen.mjs graph hash mydata.ttl
./bin/kgen.mjs templates ls
```

## Core Commands Overview

### 🔄 Graph Operations
```bash
# Generate canonical hash of RDF graph
kgen graph hash <file.ttl>

# Compare two graphs and show impact analysis  
kgen graph diff <graph1.ttl> <graph2.ttl>

# Build searchable index of RDF graph
kgen graph index <file.ttl>
```

### 🎯 Artifact Generation
```bash
# Generate deterministic artifacts
kgen artifact generate --graph data.ttl --template mytemplate --output ./dist

# Detect drift between expected and actual artifacts
kgen artifact drift <directory>

# Explain artifact generation with provenance
kgen artifact explain <artifact-file>
```

### 📦 Project Management
```bash
# Create lockfile for reproducible builds
kgen project lock [directory]

# Generate cryptographic attestation bundle
kgen project attest [directory]
```

### 🎨 Template Management
```bash
# List available templates
kgen templates ls [--verbose]

# Show template details and variables
kgen templates show <template-name>
```

### 📏 Rules Management  
```bash
# List available reasoning rules
kgen rules ls

# Show rule details
kgen rules show <rule-name>
```

### ⚡ Deterministic Rendering
```bash
# Render template with deterministic output
kgen deterministic render <template> --context '{"var":"value"}' --output file.txt

# Generate artifact with attestation
kgen deterministic generate <template> --context '{"data":123}' --output artifact.js

# Validate template for deterministic rendering
kgen deterministic validate <template>

# Verify artifact reproducibility
kgen deterministic verify <artifact> --iterations 5

# Get system status
kgen deterministic status
```

## Configuration

### kgen.config.js
```javascript
export default {
  directories: {
    out: './generated',
    templates: '_templates',
    rules: './rules',
    cache: '.kgen/cache',
    state: '.kgen/state'
  },
  generate: {
    defaultTemplate: 'base',
    attestByDefault: true,
    enableSemanticEnrichment: true
  },
  drift: {
    onDrift: 'fail',
    exitCode: 3
  }
}
```

### Environment Variables
```bash
export KGEN_DEBUG=true
export KGEN_COMPLIANCE_MODE=GDPR
export KGEN_BLOCKCHAIN_ENABLED=false
```

## Output Formats

All commands return structured JSON:
```json
{
  "success": true,
  "operation": "graph:hash", 
  "file": "data.ttl",
  "hash": "sha256:abc123...",
  "timestamp": "2025-09-11T17:00:00.000Z"
}
```

## Common Use Cases

### 1. Content Creation Workflow
```bash
# 1. Validate template
kgen deterministic validate content-template

# 2. Generate content
kgen deterministic generate content-template \
  --context '{"title":"My Article","author":"John"}' \
  --output article.md

# 3. Verify reproducibility  
kgen deterministic verify article.md
```

### 2. API Code Generation
```bash
# Generate API from knowledge graph
kgen artifact generate \
  --graph api-schema.ttl \
  --template rest-api \
  --output ./src/api
```

### 3. Compliance Reporting
```bash
# Generate project attestation
kgen project attest ./my-project

# Check for unauthorized changes
kgen artifact drift ./production-code
```

## Integration Examples

### CI/CD Pipeline
```yaml
name: KGEN Validation
jobs:
  validate:
    steps:
      - run: kgen artifact drift ./dist
      - run: kgen project attest ./
```

### Programmatic Usage
```javascript
import { exec } from 'child_process';

function generateArtifact(template, context) {
  return new Promise((resolve, reject) => {
    exec(`kgen artifact generate --template ${template} --context '${JSON.stringify(context)}'`, 
         (error, stdout) => {
      if (error) reject(error);
      else resolve(JSON.parse(stdout));
    });
  });
}
```

## Troubleshooting

### Common Issues

1. **Missing c12 dependency**
   ```bash
   npm install c12
   ```

2. **Template not found**
   ```bash
   # Check available templates
   kgen templates ls
   ```

3. **Permission errors**
   ```bash
   chmod +x ./bin/kgen.mjs
   ```

4. **Config validation errors**
   ```bash
   # Test configuration
   kgen deterministic status
   ```

### Debug Mode
```bash
# Enable debug output
kgen --debug graph hash data.ttl

# Verbose output
kgen --verbose templates ls
```

## Performance Tips

1. **Use caching**: Enable template and artifact caching
2. **Batch operations**: Process multiple files together
3. **Optimize templates**: Minimize complexity for faster rendering
4. **Monitor metrics**: Use `deterministic status` to track performance

## Enterprise Features

- **Provenance Tracking**: Complete audit trail of all operations
- **Digital Signatures**: Cryptographic verification of artifacts  
- **Compliance Logging**: GDPR/SOX/HIPAA compliance support
- **Blockchain Anchoring**: Immutable integrity verification
- **Multi-format Output**: JSON-LD, Turtle, RDF/XML support

---

For complete API reference and advanced configuration, see the [KGEN Documentation](./KGEN-COMPLIANCE-AUDIT-REPORT.md).