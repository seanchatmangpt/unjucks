# KGEN CLI Reference

Complete reference for all CLI commands in the KGEN (Knowledge Graph Engine) deterministic artifact generation system.

## Command Structure

```bash
kgen [OPTIONS] <COMMAND>
kgen <command> <subcommand> [arguments] [options]
```

## Global Options

All commands support these global options:

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--help` | `-h` | boolean | false | Show command help |
| `--debug` | `-d` | boolean | false | Enable debug mode with detailed tracing |
| `--verbose` | `-v` | boolean | false | Enable verbose output |
| `--config` | `-c` | string | | Path to configuration file |

## Exit Codes

KGEN follows standard Unix conventions:

- **0**: Success - Operation completed successfully
- **1**: General error - Command failed due to invalid input, missing files, or runtime errors  
- **3**: Drift detected - Used specifically by drift detection commands when artifacts have diverged from expected state

## Graph Operations

### `kgen graph hash <file>`

Generate canonical SHA256 hash of RDF graph.

**Usage:**
```bash
kgen graph hash sample.ttl
kgen graph hash --debug large-ontology.ttl
```

**Arguments:**
- `file` (required) - Path to RDF/Turtle file

**Output Format:**
```json
{
  "success": true,
  "operation": "graph:hash",
  "result": {
    "file": "sample.ttl",
    "hash": "1ada3c84c4f41d771c91a6b44d391be85dbffbb8537522edb53074a0c636ae78",
    "size": 555,
    "mode": "fallback",
    "algorithm": "sha256"
  },
  "metadata": {
    "timestamp": "2025-09-13T03:49:05.949Z",
    "operationId": "0845bf82-b403-4979-9b3c-1be50b975d7a",
    "duration": 0.2
  }
}
```

**Exit Codes:**
- 0: Hash generated successfully
- 1: File not found or invalid RDF

### `kgen graph diff <graph1> <graph2>`

Compare two RDF graphs and show semantic differences using impact analysis.

**Usage:**
```bash
kgen graph diff baseline.ttl modified.ttl
kgen graph diff --verbose graph1.ttl graph2.ttl
```

**Arguments:**
- `graph1` (required) - First graph file path
- `graph2` (required) - Second graph file path

**Output Format:**
```json
{
  "success": true,
  "operation": "graph:diff",
  "graph1": "baseline.ttl",
  "graph2": "modified.ttl",
  "summary": {
    "totalChanges": 5,
    "added": 2,
    "removed": 1,
    "modified": 2
  },
  "changes": {
    "added": 2,
    "removed": 1,
    "changedSubjects": 3
  },
  "impactScore": 0.75,
  "riskLevel": "medium",
  "blastRadius": 3,
  "recommendations": ["Review semantic equivalence", "Validate dependent artifacts"],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `kgen graph index <file>`

Build searchable index of RDF graph with triple statistics.

**Usage:**
```bash
kgen graph index sample.ttl
kgen graph index --verbose large-ontology.ttl
```

**Arguments:**
- `file` (required) - Path to RDF/Turtle file

**Output Format:**
```json
{
  "success": true,
  "operation": "graph:index",
  "file": "sample.ttl",
  "triples": 125,
  "subjects": 45,
  "predicates": 12,
  "objects": 67,
  "index": {
    "subjects": ["ex:Person1", "ex:Person2"],
    "predicates": ["rdf:type", "foaf:name"],
    "objects": ["John Doe", "Jane Smith"]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Artifact Operations

### `kgen artifact generate [OPTIONS]`

Generate deterministic artifacts from knowledge graphs with cryptographic attestation.

**Usage:**
```bash
kgen artifact generate --graph sample.ttl --template base
kgen artifact generate -g ontology.ttl -t api -o ./src
```

**Options:**
| Flag | Long Form | Type | Description |
|------|-----------|------|-------------|
| `-g` | `--graph` | string | Path to RDF/Turtle graph file |
| `-t` | `--template` | string | Template to use for generation |
| `-o` | `--output` | string | Output directory |

**Output Format:**
```json
{
  "success": true,
  "operation": "artifact:generate",
  "graph": "sample.ttl",
  "template": "base",
  "templatePath": "templates/base.njk",
  "outputPath": "./generated/output.js",
  "contentHash": "sha256:a7e35700290a69e4ac9ccbab995ec67933cb763b39e1aac0fd4f344b91ce37c8",
  "attestationPath": "./generated/output.js.attest.json",
  "context": ["graph", "template", "environment"],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Exit Codes:**
- 0: Artifact generated successfully
- 1: Template not found, invalid graph, or generation error

### `kgen artifact drift <directory>`

Detect drift between expected and actual artifacts with configurable exit codes.

**Usage:**
```bash
kgen artifact drift ./generated
kgen artifact drift --verbose ./project
```

**Arguments:**
- `directory` (required) - Directory to check for drift

**Output Format:**
```json
{
  "success": true,
  "operation": "artifact:drift",
  "directory": "./test-data",
  "driftDetected": true,
  "exitCode": 3,
  "summary": {
    "totalArtifacts": 5,
    "driftedArtifacts": 2,
    "severityLevel": "medium"
  },
  "reportPath": "./.kgen/state/drift-report-2024-01-01.json",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "recommendations": ["Regenerate drifted artifacts", "Update baseline"]
}
```

**Exit Codes:**
- 0: No drift detected
- 3: Drift detected (configurable via `drift.exitCode` in config)
- 1: Command execution error

### `kgen artifact explain <artifact>`

Explain artifact generation with complete provenance and attestation data.

**Usage:**
```bash
kgen artifact explain ./generated/output.js
kgen artifact explain --verbose ./artifacts/service.ts
```

**Arguments:**
- `artifact` (required) - Path to artifact file

**Output Format:**
```json
{
  "success": true,
  "operation": "artifact:explain",
  "artifact": "./generated/output.js",
  "hasAttestation": true,
  "attestation": {
    "generation": {
      "template": "base",
      "templateHash": "sha256:...",
      "contextHash": "sha256:..."
    },
    "environment": {
      "generatedAt": "2024-01-01T00:00:00.000Z",
      "nodeVersion": "v18.0.0"
    },
    "verification": {
      "reproducible": true
    }
  },
  "verification": {
    "verified": true,
    "currentHash": "sha256:...",
    "expectedHash": "sha256:..."
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Project Operations

### `kgen project lock [directory]`

Generate lockfile for reproducible builds with RDF file tracking.

**Usage:**
```bash
kgen project lock
kgen project lock ./my-project
```

**Arguments:**
- `directory` (optional) - Project directory (default: current)

**Output Format:**
```json
{
  "success": true,
  "operation": "project:lock",
  "lockfile": "./kgen.lock.json",
  "filesHashed": 47,
  "rdfFiles": 12,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `kgen project attest [directory]`

Create cryptographic attestation bundle for entire project.

**Usage:**
```bash
kgen project attest
kgen project attest ./production-build
```

**Arguments:**
- `directory` (optional) - Project directory (default: current)

**Output Format:**
```json
{
  "success": true,
  "operation": "project:attest",
  "directory": "./",
  "attestationPath": "./kgen-attestation-2024-01-01T00-00-00-000Z.json",
  "summary": {
    "totalArtifacts": 15,
    "verifiedArtifacts": 13,
    "failedVerifications": 2
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Template Operations

### `kgen templates ls [OPTIONS]`

List available templates with optional detailed information.

**Usage:**
```bash
kgen templates ls
kgen templates ls --verbose
```

**Options:**
| Flag | Long Form | Type | Description |
|------|-----------|------|-------------|
| `-v` | `--verbose` | boolean | Show detailed template information |

**Output Format:**
```json
{
  "success": true,
  "operation": "templates:ls",
  "templatesDir": "./templates",
  "templates": [
    {
      "name": "api-service",
      "path": "templates/api-service.njk",
      "size": 531,
      "modified": "2025-09-12T03:37:04.586Z"
    },
    {
      "name": "simple-demo",
      "path": "templates/simple-demo.njk",
      "size": 652,
      "modified": "2025-09-12T04:25:44.067Z"
    }
  ],
  "count": 6,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `kgen templates show <template>`

Show detailed template analysis including variables and structure.

**Usage:**
```bash
kgen templates show base
kgen templates show api-service
```

**Arguments:**
- `template` (required) - Template name to analyze

**Output Format:**
```json
{
  "success": true,
  "operation": "templates:show",
  "template": "base",
  "details": {
    "name": "base",
    "path": "templates/base.njk",
    "frontmatter": {
      "to": "{{ name }}.js",
      "inject": false
    },
    "variables": ["name", "type", "description"],
    "structure": {
      "blocks": [],
      "includes": [],
      "macros": [],
      "complexity": 0
    },
    "size": 1024,
    "lines": 45,
    "modified": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Rules Operations

### `kgen rules ls`

List available reasoning rules for semantic processing.

**Usage:**
```bash
kgen rules ls
kgen rules ls --verbose
```

**Output Format:**
```json
{
  "success": true,
  "operation": "rules:ls",
  "rulesDir": "./rules",
  "rules": [
    {
      "name": "gdpr-compliance",
      "path": "./rules/compliance/gdpr-compliance.n3",
      "type": "n3",
      "size": 1258,
      "modified": "2024-01-01T00:00:00.000Z",
      "relativePath": "compliance/gdpr-compliance.n3"
    }
  ],
  "count": 4,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `kgen rules show <rule>`

Show detailed rule analysis and content.

**Usage:**
```bash
kgen rules show gdpr-compliance
kgen rules show api-governance
```

**Arguments:**
- `rule` (required) - Rule name to analyze

## Deterministic Operations

### `kgen deterministic render <template> [OPTIONS]`

Render template with deterministic output and optional RDF enrichment.

**Usage:**
```bash
kgen deterministic render templates/base.njk
kgen deterministic render template.njk --context '{"name":"User"}' --output result.js
```

**Arguments:**
- `template` (required) - Template path to render

**Options:**
| Flag | Long Form | Type | Description |
|------|-----------|------|-------------|
| `-c` | `--context` | string | JSON context for template |
| `-o` | `--output` | string | Output file path |
| `-r` | `--rdf` | string | RDF content for semantic enrichment |

**Output Format:**
```json
{
  "success": true,
  "operation": "deterministic:render",
  "template": "templates/base.njk",
  "contentHash": "sha256:...",
  "deterministic": true,
  "outputPath": "./output.js",
  "metadata": {
    "renderTime": 15.2,
    "templateSize": 1024,
    "contextKeys": ["name", "type"]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `kgen deterministic generate <template> [OPTIONS]`

Generate deterministic artifact with attestation.

**Usage:**
```bash
kgen deterministic generate templates/service.njk --output ./service.js
kgen deterministic generate template.njk --context '{"name":"API"}' --output api.ts
```

**Arguments:**
- `template` (required) - Template path to generate from

**Options:**
| Flag | Long Form | Type | Description |
|------|-----------|------|-------------|
| `-c` | `--context` | string | JSON context for template |
| `-o` | `--output` | string | Output file path |

### `kgen deterministic verify <artifact> [OPTIONS]`

Verify artifact reproducibility with multiple iterations.

**Usage:**
```bash
kgen deterministic verify ./output.js
kgen deterministic verify ./service.ts --iterations 5
```

**Arguments:**
- `artifact` (required) - Artifact path to verify

**Options:**
| Flag | Long Form | Type | Default | Description |
|------|-----------|------|---------|-------------|
| `--iterations` | `--iterations` | number | 3 | Number of verification iterations |

## Performance Operations

### `kgen perf test [OPTIONS]`

Run performance compliance tests against KGEN charter targets.

**Usage:**
```bash
kgen perf test
kgen perf test --report performance-report.json
```

**Options:**
| Flag | Long Form | Type | Description |
|------|-----------|------|-------------|
| `-r` | `--report` | string | Output report file path |

**Output Format:**
```json
{
  "success": true,
  "operation": "perf:test",
  "compliance": {
    "allPassing": true,
    "coldStart": {
      "actual": 1850,
      "target": 2000,
      "passing": true
    },
    "renderP95": {
      "actual": 120,
      "target": 150,
      "passing": true
    }
  },
  "benchmarks": {
    "coldStartTime": 1.85,
    "templateRenderTime": 0.12,
    "graphHashTime": 0.08
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Exit Codes:**
- 0: All performance tests pass
- 1: Performance tests fail or error

### `kgen perf status`

Show current performance metrics and charter compliance.

**Usage:**
```bash
kgen perf status
```

**Output Format:**
```json
{
  "success": true,
  "operation": "perf:status",
  "coldStart": {
    "elapsed": 376.47,
    "target": 2000,
    "status": "PASS"
  },
  "charter": {
    "coldStartTarget": "≤2s",
    "renderTarget": "≤150ms p95",
    "cacheTarget": "≥80%"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `kgen perf benchmark [OPTIONS]`

Run performance benchmarks for core operations.

**Usage:**
```bash
kgen perf benchmark
kgen perf benchmark --type graph-hash
kgen perf benchmark --type template-render
```

**Options:**
| Flag | Long Form | Type | Default | Description |
|------|-----------|------|---------|-------------|
| `--type` | `--type` | string | full | Benchmark type (graph-hash, template-render, full) |

## Validation Operations

### `kgen validate artifacts <path> [OPTIONS]`

Validate generated artifacts with SHACL schema validation.

**Usage:**
```bash
kgen validate artifacts ./generated
kgen validate artifacts . --recursive --shapes-file shapes.ttl
```

**Arguments:**
- `path` (optional) - Path to artifact or directory (default: current)

**Options:**
| Flag | Long Form | Type | Description |
|------|-----------|------|-------------|
| `-r` | `--recursive` | boolean | Recursively validate directories |
| `-s` | `--shapes-file` | string | Path to SHACL shapes file for validation |
| `-v` | `--verbose` | boolean | Enable verbose validation output |

**Output Format:**
```json
{
  "success": true,
  "operation": "validate:artifacts",
  "path": "./generated",
  "summary": {
    "totalFiles": 10,
    "validFiles": 8,
    "errors": 2,
    "warnings": 1
  },
  "results": [
    {
      "file": "./generated/output.js",
      "valid": true,
      "attestationValid": true,
      "shaclResults": []
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Exit Codes:**
- 0: All artifacts valid
- 1: Validation errors found

### `kgen validate graph <file> [OPTIONS]`

Validate RDF graphs with optional SHACL validation.

**Usage:**
```bash
kgen validate graph sample.ttl
kgen validate graph ontology.ttl --shacl
```

**Arguments:**
- `file` (required) - Path to RDF file

**Options:**
| Flag | Long Form | Type | Description |
|------|-----------|------|-------------|
| `--shacl` | `--shacl` | boolean | Enable SHACL validation |

## Drift Detection

### `kgen drift detect <directory>`

Alternative access to drift detection functionality.

**Usage:**
```bash
kgen drift detect ./generated
kgen drift detect ./project --verbose
```

**Arguments:**
- `directory` (required) - Directory to check for drift

**Note:** This is equivalent to `kgen artifact drift` but provides alternative access.

## Error Handling

All commands return structured JSON output for machine consumption:

**Error Response Format:**
```json
{
  "success": false,
  "operation": "graph:hash",
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File not found: nonexistent.ttl",
    "details": {
      "path": "nonexistent.ttl"
    }
  },
  "metadata": {
    "timestamp": "2025-09-13T03:47:35.605Z",
    "operationId": "22081cbf-c219-44c1-9c9b-e093ba7b1860",
    "duration": 0.04
  }
}
```

**Common Error Codes:**
- `FILE_NOT_FOUND`: Specified file does not exist
- `INVALID_RDF`: RDF parsing failed
- `TEMPLATE_NOT_FOUND`: Template file missing
- `DRIFT_DETECTOR_UNAVAILABLE`: Drift detection system not initialized
- `OPERATION_FAILED`: General operation failure

## Configuration

Commands can be configured via `kgen.config.js` file. Key configuration options:

```javascript
export default {
  directories: {
    templates: 'templates',  // Template directory (default: _templates)
    out: './generated',      // Output directory
    state: './.kgen/state'   // State directory for drift detection
  },
  drift: {
    onDrift: 'fail',        // Action on drift detection
    exitCode: 3             // Exit code for drift detected
  }
}
```

See [Configuration Reference](./configuration.md) for complete details.

---

**Last Updated**: September 12, 2025  
**CLI Version**: 1.0.0  
**Implementation Parity**: Complete