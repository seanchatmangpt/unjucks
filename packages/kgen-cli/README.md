# KGEN CLI - Knowledge Graph to Artifact Compilation Tool

A deterministic, stateless command-line utility designed for autonomous agents to compile knowledge graphs into concrete artifacts.

## Overview

KGEN CLI implements the "Knowledge as Source" philosophy where RDF knowledge graphs serve as the single source of truth for system architecture and policies. All generated artifacts are considered ephemeral, reproducible build products derived from the canonical graph.

## Installation

```bash
cd packages/kgen-cli
npm install
chmod +x bin/kgen.js
```

## Architecture

The CLI follows a noun-verb structure designed for autonomous agent consumption:

```
kgen <tool> <verb> [options]
```

### Available Tools

- **artifact** - Generate, validate, and explain artifacts from knowledge graphs
- **graph** - Process and analyze knowledge graphs  
- **project** - Project-level operations for reproducible builds
- **cache** - Manage content-addressed cache
- **templates** - Manage Nunjucks templates
- **rules** - Manage N3.js rule packs
- **metrics** - Performance and usage metrics

## Key Features

### Deterministic Generation
- Byte-for-byte identical outputs for given inputs
- SHA256 hashing for canonical graph identification
- Reproducible builds across environments

### Autonomous Agent Optimized
- JSON output for all commands (machine-parseable)
- No interactive prompts
- Structured error handling with exit codes
- Comprehensive help system

### Provenance Tracking
- `.attest.json` sidecars for every generated artifact
- Complete audit trail from graph to artifact
- Cryptographic verification of integrity

### Drift Detection
- Automatic detection of unauthorized modifications
- CI/CD pipeline integration via exit codes
- Comprehensive reporting of changes

## Usage Examples

### Basic Operations

```bash
# Calculate canonical hash of knowledge graph
./bin/kgen.js graph hash --input knowledge.ttl

# Generate artifacts from graph using template
./bin/kgen.js artifact generate --graph api-model.ttl --template api-service

# Check for drift in generated artifacts
./bin/kgen.js artifact drift --check dist/

# Create reproducible lockfile
./bin/kgen.js project lock --graph knowledge.ttl --output project.lock
```

### Cache Management

```bash
# List cache contents
./bin/kgen.js cache ls --sort size

# Clean old cache entries
./bin/kgen.js cache gc --max-age 30d

# Show cache entry details
./bin/kgen.js cache show --hash abc123def
```

### Templates and Rules

```bash
# List available templates
./bin/kgen.js templates ls --type njk

# Show template details
./bin/kgen.js templates show --name api-service

# List rule packs
./bin/kgen.js rules ls --type compliance
```

### Performance Monitoring

```bash
# Export metrics data
./bin/kgen.js metrics export --period 7d --format json

# Generate performance report
./bin/kgen.js metrics report --type performance --period 30d

# Establish performance baseline
./bin/kgen.js metrics baseline --operation generate --samples 10
```

## Configuration

KGEN CLI uses `c12` for configuration management. Create a `kgen.config.js` file:

```javascript
export default {
  project: {
    name: 'my-project',
    version: '1.0.0'
  },
  directories: {
    out: './dist',
    templates: './templates',
    rules: './rules',
    cache: './.kgen/cache'
  },
  generate: {
    attestByDefault: true
  }
}
```

## Output Format

All commands output structured JSON for autonomous agent consumption:

```json
{
  "success": true,
  "data": {
    "operation": "hash",
    "hash": "7ed75b3604e563735ea144a1ffeb9af94915af49568203c0d5ecd739d43fff41",
    "statistics": {
      "triples": 38,
      "subjects": 7,
      "predicates": 15
    }
  },
  "metadata": {
    "timestamp": "2025-09-11T18:56:21.118Z",
    "deterministic": true
  }
}
```

## Dependencies

- **citty** - Modern CLI framework with TypeScript support
- **n3** - Fast, streaming Turtle/N-Triples/N-Quads parser and writer
- **nunjucks** - Rich templating language with inheritance
- **c12** - Smart configuration loader
- **chalk** - Terminal colors and styling
- **fast-glob** - Fast file pattern matching
- **yaml** - YAML 1.2 parser and serializer

## Error Handling

The CLI uses structured error responses and appropriate exit codes:

- `0` - Success
- `1` - General error
- `2` - Verification failed (integrity mismatch)
- `3` - Drift detected (configurable)

## Testing

Test the CLI with the provided sample graph:

```bash
# Hash the sample graph
./bin/kgen.js graph hash --input test/sample-graph.ttl

# Generate index
./bin/kgen.js graph index --input test/sample-graph.ttl
```

## Architecture Decisions

1. **JSON-first output** - All commands output machine-parseable JSON
2. **No interactivity** - Designed for autonomous operation
3. **Deterministic by design** - Same inputs always produce identical outputs
4. **Provenance-first** - Every artifact includes complete audit trail
5. **Cache-aware** - Content-addressed caching for performance
6. **Standards-compliant** - Uses W3C RDF standards and PROV-O for provenance

## License

MIT