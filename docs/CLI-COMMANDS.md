# KGEN v1 CLI Commands Reference

## Complete Command List

Based on the KGEN CLI implementation, here are all available commands with examples and descriptions:

### Core Commands

#### `kgen --help`
Show main CLI help and available commands.

```bash
kgen --help
kgen --version
```

### Graph Commands

#### `kgen graph hash <file>`
Generate canonical SHA256 hash of RDF graph.

```bash
# Hash a Turtle file
kgen graph hash knowledge/domain.ttl

# Output example:
{
  "success": true,
  "operation": "graph:hash",
  "file": "knowledge/domain.ttl",
  "hash": "sha256:abc123...",
  "size": 2048,
  "algorithm": "sha256"
}
```

#### `kgen graph diff <graph1> <graph2>`
Compare two RDF graphs and show semantic differences.

```bash
# Compare baseline with current state
kgen graph diff baseline.ttl current.ttl

# Output includes impact analysis
{
  "success": true,
  "operation": "graph:diff",
  "graph1": "baseline.ttl",
  "graph2": "current.ttl",
  "summary": { "added": 5, "removed": 2, "changed": 3 },
  "impactScore": 0.75,
  "riskLevel": "medium"
}
```

#### `kgen graph index <file>`
Build searchable index of RDF graph triples.

```bash
# Index graph for fast queries
kgen graph index knowledge/domain.ttl

# Output shows triple statistics
{
  "success": true,
  "operation": "graph:index",
  "file": "knowledge/domain.ttl",
  "triples": 150,
  "subjects": 45,
  "predicates": 12,
  "objects": 93
}
```

### Artifact Commands

#### `kgen artifact generate [options]`
Generate deterministic artifacts from knowledge graphs.

```bash
# Basic generation
kgen artifact generate --graph knowledge/api.ttl --template rest-api

# With custom output directory
kgen artifact generate \
  --graph knowledge/domain.ttl \
  --template typescript-client \
  --output src/generated/

# Output includes provenance
{
  "success": true,
  "operation": "artifact:generate",
  "graph": "knowledge/api.ttl",
  "template": "rest-api",
  "outputPath": "generated/api-service.ts",
  "contentHash": "sha256:def456...",
  "attestationPath": "generated/api-service.ts.attest.json"
}
```

#### `kgen artifact drift <directory>`
Detect drift between expected and actual artifacts.

```bash
# Check for drift in generated directory
kgen artifact drift ./generated

# Output shows drift status
{
  "success": true,
  "operation": "artifact:drift",
  "directory": "./generated",
  "driftDetected": false,
  "summary": {
    "filesChecked": 12,
    "driftFiles": 0,
    "unchangedFiles": 12
  }
}
```

#### `kgen artifact explain <artifact>`
Explain artifact generation with complete provenance.

```bash
# Show provenance for generated file
kgen artifact explain generated/api-service.ts

# Output includes full lineage
{
  "success": true,
  "operation": "artifact:explain",
  "artifact": "generated/api-service.ts",
  "provenance": {
    "template": "_templates/rest-api.njk",
    "templateHash": "sha256:ghi789...",
    "contextHash": "sha256:jkl012...",
    "generatedAt": "2024-01-01T00:00:00.000Z",
    "reproducible": true
  }
}
```

### Template Commands

#### `kgen templates ls [--verbose]`
List available templates with optional metadata.

```bash
# Simple template list
kgen templates ls

# Detailed template information
kgen templates ls --verbose

# Output shows available templates
{
  "success": true,
  "operation": "templates:ls",
  "templatesDir": "_templates",
  "templates": [
    {
      "name": "rest-api",
      "path": "_templates/rest-api.njk",
      "size": 2048,
      "variables": ["serviceName", "endpoints"]
    }
  ]
}
```

#### `kgen templates show <template>`
Show detailed template information and required variables.

```bash
# Analyze specific template
kgen templates show rest-api

# Output shows template details
{
  "success": true,
  "operation": "templates:show",
  "template": "rest-api",
  "details": {
    "name": "rest-api",
    "path": "_templates/rest-api.njk",
    "variables": ["serviceName", "endpoints", "schemas"],
    "structure": {
      "blocks": ["content"],
      "includes": ["partials/headers.njk"],
      "complexity": 3
    }
  }
}
```

### Rules Commands

#### `kgen rules ls`
List available reasoning rules and SHACL shapes.

```bash
# List all rules
kgen rules ls

# Output shows rule files
{
  "success": true,
  "operation": "rules:ls",
  "rulesDir": "./rules",
  "rules": [
    {
      "name": "api-constraints",
      "path": "rules/api-constraints.ttl",
      "type": "ttl",
      "size": 1024
    }
  ]
}
```

#### `kgen rules show <rule>`
Show detailed rule information.

```bash
# Analyze specific rule
kgen rules show api-constraints

# Output shows rule details
{
  "success": true,
  "operation": "rules:show",
  "rule": "api-constraints",
  "details": {
    "name": "api-constraints",
    "path": "rules/api-constraints.ttl",
    "type": "ttl",
    "lines": 45,
    "ruleCount": 8,
    "prefixes": [
      {"prefix": "sh", "uri": "http://www.w3.org/ns/shacl#"}
    ]
  }
}
```

### Deterministic Commands

#### `kgen deterministic render <template> [options]`
Render template with deterministic output.

```bash
# Render template with context
kgen deterministic render _templates/api.njk \
  --context '{"serviceName":"user-service"}' \
  --output generated/api.ts

# Output shows rendering result
{
  "success": true,
  "operation": "deterministic:render",
  "template": "_templates/api.njk",
  "contentHash": "sha256:abc123...",
  "deterministic": true,
  "outputPath": "generated/api.ts"
}
```

#### `kgen deterministic generate <template> [options]`
Generate deterministic artifact with attestation.

```bash
# Generate with full attestation
kgen deterministic generate _templates/service.njk \
  --context '{"name":"payment-service"}' \
  --output generated/payment.ts

# Output includes attestation
{
  "success": true,
  "operation": "deterministic:generate",
  "template": "_templates/service.njk",
  "outputPath": "generated/payment.ts",
  "attestationPath": "generated/payment.ts.attest.json",
  "contentHash": "sha256:def456..."
}
```

#### `kgen deterministic validate <template>`
Validate template for deterministic rendering.

```bash
# Check template determinism
kgen deterministic validate _templates/api.njk

# Output shows validation results
{
  "success": true,
  "operation": "deterministic:validate",
  "template": "_templates/api.njk",
  "deterministicScore": 0.95,
  "issues": [],
  "recommendations": ["Consider using static timestamps"]
}
```

#### `kgen deterministic verify <artifact> [--iterations N]`
Verify artifact reproducibility.

```bash
# Verify reproducibility with 3 iterations
kgen deterministic verify generated/api.ts --iterations 3

# Output shows verification result
{
  "success": true,
  "operation": "deterministic:verify",
  "artifact": "generated/api.ts",
  "verified": true,
  "iterations": 3,
  "originalHash": "sha256:abc123...",
  "reproductions": [
    {"hash": "sha256:abc123...", "match": true},
    {"hash": "sha256:abc123...", "match": true},
    {"hash": "sha256:abc123...", "match": true}
  ]
}
```

#### `kgen deterministic status`
Get deterministic rendering system status.

```bash
# Check system health
kgen deterministic status

# Output shows system status
{
  "success": true,
  "operation": "deterministic:status",
  "health": "healthy",
  "statistics": {
    "totalRenderings": 150,
    "cacheHitRate": 0.82,
    "avgRenderTime": 89
  }
}
```

### Project Commands

#### `kgen project lock [directory]`
Generate lockfile for reproducible builds.

```bash
# Create lockfile for current project
kgen project lock

# Create lockfile for specific directory
kgen project lock ./my-project

# Output shows lockfile creation
{
  "success": true,
  "operation": "project:lock",
  "lockfile": "kgen.lock.json",
  "filesHashed": 25,
  "rdfFiles": 8
}
```

#### `kgen project attest [directory]`
Create cryptographic attestation bundle.

```bash
# Create project attestation
kgen project attest

# Output shows attestation summary
{
  "success": true,
  "operation": "project:attest",
  "attestationPath": "kgen-attestation-20241201.json",
  "summary": {
    "totalArtifacts": 12,
    "verifiedArtifacts": 12,
    "failedVerifications": 0
  }
}
```

### Validation Commands

#### `kgen validate artifacts <path> [options]`
Validate artifacts against SHACL shapes.

```bash
# Validate all artifacts in directory
kgen validate artifacts ./generated --recursive

# Validate with custom shapes file
kgen validate artifacts ./generated \
  --shapes-file rules/api-shapes.ttl \
  --verbose

# Output shows validation results
{
  "success": true,
  "operation": "validate:artifacts",
  "path": "./generated",
  "summary": {
    "filesValidated": 12,
    "passed": 11,
    "failed": 1,
    "warnings": 3
  }
}
```

#### `kgen validate graph <file> [--shacl]`
Validate RDF graphs for structural correctness.

```bash
# Basic graph validation
kgen validate graph knowledge/domain.ttl

# With SHACL validation
kgen validate graph knowledge/domain.ttl --shacl

# Output shows validation status
{
  "success": true,
  "operation": "validate:graph",
  "file": "knowledge/domain.ttl",
  "valid": true,
  "violations": 0
}
```

#### `kgen validate provenance <artifact>`
Validate provenance chains and attestations.

```bash
# Validate artifact provenance
kgen validate provenance generated/api-service.ts

# Output shows provenance validation
{
  "success": true,
  "operation": "validate:provenance",
  "artifact": "generated/api-service.ts",
  "provenanceValid": true,
  "signatureValid": true,
  "reproducible": true
}
```

### Performance Commands

#### `kgen perf test [--report file]`
Run performance compliance tests.

```bash
# Run performance tests
kgen perf test

# Generate report file
kgen perf test --report performance-report.json

# Output shows compliance status
{
  "success": true,
  "operation": "perf:test",
  "compliance": {
    "coldStart": {"target": 2000, "actual": 1200, "status": "PASS"},
    "rendering": {"target": 150, "actual": 89, "status": "PASS"},
    "allPassing": true
  }
}
```

#### `kgen perf status`
Show current performance metrics.

```bash
# Check performance status
kgen perf status

# Output shows current metrics
{
  "success": true,
  "operation": "perf:status",
  "coldStart": {
    "elapsed": 1.2,
    "target": 2000,
    "status": "PASS"
  },
  "charter": {
    "coldStartTarget": "≤2s",
    "renderTarget": "≤150ms p95"
  }
}
```

#### `kgen perf benchmark [--type type] [--iterations N]`
Run performance benchmarks.

```bash
# Run all benchmarks
kgen perf benchmark

# Run specific benchmark
kgen perf benchmark --type graph-hash --iterations 100

# Output shows benchmark results
{
  "success": true,
  "operation": "perf:benchmark",
  "benchmarks": {
    "graphHash": {
      "avgTime": 45,
      "minTime": 32,
      "maxTime": 78,
      "iterations": 100
    }
  }
}
```

### Query Commands

#### `kgen query sparql <graph> [options]`
Execute SPARQL queries against RDF graphs.

```bash
# Query with string
kgen query sparql knowledge/domain.ttl \
  --query "SELECT * WHERE { ?s ?p ?o } LIMIT 10"

# Query from file
kgen query sparql knowledge/domain.ttl \
  --file queries/list-services.sparql \
  --format json

# Output shows query results
{
  "success": true,
  "operation": "query:sparql",
  "graph": "knowledge/domain.ttl",
  "results": [
    {"s": "ex:Service1", "p": "rdf:type", "o": "kgen:RestAPI"}
  ]
}
```

### Generate Commands

#### `kgen generate docs <graph> [options]`
Generate documentation from knowledge graphs.

```bash
# Generate API docs
kgen generate docs knowledge/api-spec.ttl \
  --template openapi-spec \
  --output docs/api.yaml

# Output shows generation result
{
  "success": true,
  "operation": "generate:docs",
  "graph": "knowledge/api-spec.ttl",
  "template": "openapi-spec",
  "output": "docs/api.yaml"
}
```

### Drift Commands

#### `kgen drift detect <directory>`
Alternative access to drift detection.

```bash
# Detect drift in directory
kgen drift detect ./generated

# Same functionality as artifact drift
{
  "success": true,
  "operation": "drift:detect",
  "directory": "./generated",
  "driftDetected": false
}
```

## Global Options

All commands support these global options:

```bash
--debug, -d      # Enable debug mode
--verbose, -v    # Enable verbose output  
--config, -c     # Path to configuration file
```

## Examples by Use Case

### Complete API Generation Workflow
```bash
# 1. Create knowledge graph
kgen graph index knowledge/api-spec.ttl

# 2. Validate graph structure
kgen validate graph knowledge/api-spec.ttl --shacl

# 3. Generate API artifacts
kgen artifact generate \
  --graph knowledge/api-spec.ttl \
  --template typescript-api \
  --output src/generated/

# 4. Verify generation
kgen artifact explain src/generated/api.ts

# 5. Check for drift
kgen artifact drift src/generated/

# 6. Create project attestation
kgen project attest
```

### Template Development Workflow
```bash
# 1. List existing templates
kgen templates ls --verbose

# 2. Analyze template structure
kgen templates show rest-api

# 3. Validate template determinism
kgen deterministic validate _templates/my-template.njk

# 4. Test rendering
kgen deterministic render _templates/my-template.njk \
  --context '{"service":"test"}' \
  --output test-output.ts

# 5. Verify reproducibility
kgen deterministic verify test-output.ts --iterations 5
```

### Validation and Compliance Workflow
```bash
# 1. Validate all artifacts
kgen validate artifacts ./generated --recursive

# 2. Check SHACL compliance
kgen validate graph knowledge/*.ttl --shacl

# 3. Verify provenance chains
kgen validate provenance generated/critical-service.ts

# 4. Performance compliance check
kgen perf test --report compliance-report.json
```

All commands return structured JSON output for easy integration with CI/CD pipelines and automation tools.