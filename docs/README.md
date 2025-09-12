# KGEN - Knowledge Graph Engine

A powerful command-line tool for deterministic artifact generation from RDF knowledge graphs with built-in provenance tracking, drift detection, and cryptographic attestations.

## Overview

KGEN transforms RDF knowledge graphs into deterministic, reproducible artifacts using Nunjucks templates. Every generated artifact includes cryptographic attestations ensuring reproducibility and traceability.

### Key Features

- **Deterministic Generation**: Byte-for-byte reproducible outputs
- **RDF Integration**: Native support for Turtle, RDF/XML, JSON-LD
- **Drift Detection**: Automatic detection of configuration drift
- **Cryptographic Attestations**: Built-in provenance and integrity verification
- **Template System**: Flexible Nunjucks-based templates with semantic enrichment
- **Content Addressing**: Efficient caching based on content hashes
- **SPARQL Queries**: Query capabilities for knowledge graphs
- **Project Lifecycle**: Lockfiles, validation, and attestation management

## Quick Start

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
npm install

# Make CLI executable
chmod +x bin/kgen.mjs
```

### Basic Usage

```bash
# Generate hash of RDF graph
./bin/kgen.mjs graph hash test-graph.ttl

# Generate artifact from graph using template
./bin/kgen.mjs artifact generate -g test-graph.ttl -t api-service -o ./output

# List available templates
./bin/kgen.mjs templates ls

# Create project lockfile
./bin/kgen.mjs project lock .

# Check for drift
./bin/kgen.mjs artifact drift ./output
```

## Core Concepts

### Knowledge Graphs
KGEN processes RDF knowledge graphs in various formats (Turtle, RDF/XML, JSON-LD) and extracts semantic information to drive code generation.

### Templates
Nunjucks templates with frontmatter configuration that define how knowledge graphs are transformed into artifacts. Templates support semantic enrichment through RDF data.

### Deterministic Generation
Every artifact generation is reproducible - given the same inputs, KGEN produces identical outputs with the same content hash.

### Attestations
Cryptographic attestations (`.attest.json` files) provide tamper-evident provenance data including template hashes, context hashes, and generation metadata.

### Drift Detection
KGEN tracks changes in generated artifacts and configuration, alerting when actual state diverges from expected state.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  RDF Knowledge  │    │    Templates    │    │  Configuration  │
│     Graphs      │───▶│   (Nunjucks)    │───▶│   (kgen.config) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌───────────────────────────────────────────────────────────────────┐
│              KGEN Deterministic Rendering Engine                │
│  • Content Addressing  • RDF Integration  • Error Handling     │
└───────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Generated     │    │  Cryptographic  │    │  Cache &        │
│   Artifacts     │    │  Attestations   │    │  Metrics        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Project Structure

```
├── bin/kgen.mjs           # Main CLI executable
├── src/kgen/              # Core KGEN modules
│   ├── deterministic/     # Deterministic rendering system
│   ├── rdf/               # RDF processing components
│   ├── drift/             # Drift detection engine
│   └── impact/            # Impact analysis calculator
├── _templates/            # Template directory
├── generated/             # Default output directory
├── kgen.config.js         # Configuration file
└── kgen.lock.json         # Project lockfile
```

## Configuration

Create a `kgen.config.js` file for project-specific settings:

```javascript
export default {
  directories: {
    out: './dist',
    templates: '_templates',
    cache: '.kgen/cache'
  },
  generate: {
    defaultTemplate: 'base',
    attestByDefault: true,
    enableContentAddressing: true
  },
  drift: {
    onDrift: 'warn',
    exitCode: 3
  }
};
```

## Templates

Templates are Nunjucks files with YAML frontmatter:

```nunjucks
---
to: "{{ graph.entity.name | lower }}-controller.js"
inject: true
skipIf: "{{ graph.entity.type !== 'Entity' }}"
---
// Generated from {{ graph.path }}
class {{ graph.entity.name }}Controller {
  {% for property in graph.entity.properties %}
  validate{{ property.name | title }}(value) {
    // Validation logic for {{ property.name }}
  }
  {% endfor %}
}
```

## Common Workflows

### 1. Project Setup
```bash
# Initialize configuration
echo 'export default { /* config */ };' > kgen.config.js

# Create templates directory
mkdir -p _templates

# Generate initial lockfile
./bin/kgen.mjs project lock
```

### 2. Development Workflow
```bash
# Generate artifacts
./bin/kgen.mjs artifact generate -g schema.ttl -t api-service

# Validate templates
./bin/kgen.mjs deterministic validate _templates/api-service.njk

# Check for drift
./bin/kgen.mjs artifact drift ./generated
```

### 3. Production Deployment
```bash
# Create project attestation
./bin/kgen.mjs project attest

# Verify reproducibility
./bin/kgen.mjs deterministic verify ./generated/api-service.js
```

## Next Steps

- [CLI Reference Guide](CLI_REFERENCE.md) - Complete command documentation
- [Template Examples](EXAMPLES.md) - Real-world template examples
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions

## Support

For issues and questions:
- Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
- Review command help: `./bin/kgen.mjs <command> --help`
- Enable debug mode: `./bin/kgen.mjs --debug <command>`