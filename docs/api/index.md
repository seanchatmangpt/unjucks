# KGEN API Documentation

## Overview

This documentation provides comprehensive coverage of all KGEN APIs, from CLI commands to enterprise-scale semantic processing capabilities. The system integrates deterministic artifact generation, RDF graph processing, and cryptographic attestation for reproducible builds.

## Documentation Structure

### 📚 Core References

1. **[CLI Reference](./cli-reference.md)** - Complete command-line interface documentation
   - Complete CLI command coverage with exact flags
   - JSON output format specifications
   - Exit code documentation (0, 1, 3)
   - Error handling and validation

2. **[MCP Integration](./mcp-integration.md)** - Model Context Protocol server integration
   - Claude Flow coordination APIs
   - rUv Swarm neural processing
   - Flow Nexus enterprise deployment
   - Connection management and pooling

3. **[Semantic Web APIs](./semantic-web.md)** - RDF processing and SPARQL querying
   - RDF data loading and conversion
   - SPARQL query execution and optimization
   - Ontology validation and compliance
   - Advanced reasoning and inference

4. **[Configuration](./configuration.md)** - System configuration management
   - TypeScript configuration with c12
   - Environment-specific settings
   - Performance tuning parameters
   - Plugin and extension system

5. **[Hooks System](./hooks-system.md)** - Automation and coordination
   - Task lifecycle hooks
   - Agent coordination hooks
   - Performance monitoring hooks
   - Session management

### 🚀 Performance & Enterprise

6. **[Performance Tuning](./performance-tuning.md)** - Optimization guidelines
   - Template processing optimization
   - Semantic web performance
   - Agent coordination efficiency
   - System resource management
   - Production deployment strategies

7. **[OpenAPI Specification](./openapi-specification.md)** - Complete API specification
   - RESTful API endpoints
   - Request/response schemas
   - Authentication methods
   - Code examples and webhooks

## Quick Start

### Basic Artifact Generation
```bash
# Generate from RDF graph
kgen artifact generate --graph sample.ttl --template base --output ./generated

# Generate with specific template
kgen artifact generate --graph ontology.ttl --template api --output ./src

# Deterministic rendering
kgen deterministic render _templates/base.njk --context '{"name":"User","type":"service"}' --output ./output.js
```

### Graph Processing
```bash
# Hash RDF graph
kgen graph hash sample.ttl

# Compare graphs
kgen graph diff baseline.ttl modified.ttl

# Index graph triples
kgen graph index large-ontology.ttl
```

### Drift Detection
```bash
# Detect artifact drift
kgen artifact drift ./generated

# Alternative drift detection
kgen drift detect ./project
```

## Key Features

### 🎯 Deterministic Generation
- **Content Addressing** with SHA-256 hashing for reproducible artifacts
- **Template Engine** using Nunjucks with deterministic rendering
- **Cryptographic Attestation** with .attest.json provenance files
- **Single Entrypoint** architecture with no index.* files
- **Performance Optimized** with ≤2s cold start target

### 🧠 RDF Graph Processing
- **Multi-format Support** (Turtle, N-Triples, JSON-LD, RDF/XML)
- **Canonical Hashing** for semantic equivalence detection
- **SPARQL Querying** with N3.js integration
- **SHACL Validation** for data quality assurance
- **Drift Detection** with configurable exit codes (0, 1, 3)

### 🔒 Provenance & Security
- **Cryptographic Signatures** using Ed25519 for artifact integrity
- **Reproducible Builds** with deterministic timestamps
- **Content Addressing** for immutable artifact storage
- **Security Validation** with input sanitization and sandboxing
- **Audit Trails** with complete generation provenance

### ⚡ Enterprise Performance
- **Lazy Loading** for optimal cold start performance
- **Memory Management** with LRU caching and GC optimization
- **Performance Monitoring** with built-in benchmarking
- **Error Handling** with structured JSON responses
- **Production Ready** with comprehensive testing

## Support and Resources

### Documentation Links
- **CLI Reference**: Complete command documentation
- **MCP Integration**: Server setup and API usage
- **Semantic Web**: RDF processing and SPARQL queries
- **Configuration**: System configuration options
- **Hooks System**: Automation and coordination
- **Performance**: Optimization guidelines
- **OpenAPI Spec**: REST API reference

---

**Last Updated**: January 7, 2025  
**API Version**: v1  
**Documentation Version**: 2025.09.06