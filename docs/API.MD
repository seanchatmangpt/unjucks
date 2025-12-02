# KGEN API Documentation

## Overview

KGEN (Knowledge Graph Engine) is a deterministic artifact generation system that produces cryptographically attestable outputs from RDF knowledge graphs using template-based generation.

## Exit Codes

KGEN follows standard Unix exit code conventions:

- **0**: Success - Operation completed successfully
- **1**: General error - Command failed due to invalid input, missing files, or runtime errors  
- **3**: Drift detected - Used specifically by drift detection commands when artifacts have diverged from expected state

## Command Line Interface

### Main Commands

```bash
kgen [OPTIONS] <COMMAND>
```

#### Global Options

| Flag | Long Form | Type | Description |
|------|-----------|------|-------------|
| `-d` | `--debug` | boolean | Enable debug mode with detailed tracing |
| `-v` | `--verbose` | boolean | Enable verbose output |
| `-c` | `--config` | string | Path to configuration file |

### Graph Operations

#### `kgen graph hash <file>`

Generate canonical SHA256 hash of RDF graph.

**Arguments:**
- `file` (required) - Path to RDF/Turtle file

**Output Format:**
```json
{
  "success": true,
  "operation": "graph:hash",
  "file": "sample.ttl",
  "hash": "3902c03413a4f0d3b4d9afc0db53634ff8eb0e156d24c6ce412fc47b3aaee3a8",
  "size": 1497,
  "algorithm": "sha256",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Exit Codes:**
- 0: Hash generated successfully
- 1: File not found or invalid RDF

#### `kgen graph diff <graph1> <graph2>`

Compare two RDF graphs and show semantic differences.

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

#### `kgen graph index <file>`

Build searchable index of RDF graph with triple statistics.

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

### Artifact Operations

#### `kgen artifact generate [OPTIONS]`

Generate deterministic artifacts from knowledge graphs.

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
  "templatePath": "_templates/base.njk",
  "outputPath": "./generated/output.js",
  "contentHash": "sha256:a7e35700290a69e4ac9ccbab995ec67933cb763b39e1aac0fd4f344b91ce37c8",
  "attestationPath": "./generated/output.js.attest.json",
  "context": ["graph", "template", "environment"],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `kgen artifact drift <directory>`

Detect drift between expected and actual artifacts.

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

#### `kgen artifact explain <artifact>`

Explain artifact generation with provenance data.

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
  "provenance": {
    "template": "base",
    "templateHash": "sha256:...",
    "contextHash": "sha256:...",
    "generatedAt": "2024-01-01T00:00:00.000Z",
    "nodeVersion": "v18.0.0",
    "reproducible": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Project Operations

#### `kgen project lock [directory]`

Generate lockfile for reproducible builds.

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

#### `kgen project attest [directory]`

Create cryptographic attestation bundle for entire project.

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

### Template Operations

#### `kgen templates ls [OPTIONS]`

List available templates.

**Options:**
| Flag | Long Form | Type | Description |
|------|-----------|------|-------------|
| `-v` | `--verbose` | boolean | Show detailed template information |

**Output Format:**
```json
{
  "success": true,
  "operation": "templates:ls",
  "templatesDir": "_templates",
  "templates": [
    {
      "name": "base",
      "path": "_templates/base.njk",
      "size": 1024,
      "modified": "2024-01-01T00:00:00.000Z",
      "variables": ["name", "type", "description"],
      "frontmatter": {
        "to": "{{ name }}.js",
        "inject": false
      }
    }
  ],
  "count": 1,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `kgen templates show <template>`

Show detailed template analysis.

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
    "path": "_templates/base.njk",
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

### Deterministic Operations

#### `kgen deterministic render <template> [OPTIONS]`

Render template with deterministic output.

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
  "template": "_templates/base.njk",
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

#### `kgen deterministic verify <artifact> [OPTIONS]`

Verify artifact reproducibility.

**Arguments:**
- `artifact` (required) - Artifact path to verify

**Options:**
| Flag | Long Form | Type | Default | Description |
|------|-----------|------|---------|-------------|
| `--iterations` | `--iterations` | number | 3 | Number of verification iterations |

**Output Format:**
```json
{
  "success": true,
  "operation": "deterministic:verify",
  "artifact": "./output.js",
  "verified": true,
  "iterations": 3,
  "originalHash": "sha256:...",
  "reproductions": [
    {
      "iteration": 1,
      "hash": "sha256:...",
      "matches": true
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Performance Operations

#### `kgen perf test [OPTIONS]`

Run performance compliance tests.

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

#### `kgen perf status`

Show current performance metrics.

**Output Format:**
```json
{
  "success": true,
  "operation": "perf:status",
  "coldStart": {
    "elapsed": 1.85,
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

### Validation Operations

#### `kgen validate artifacts <path> [OPTIONS]`

Validate generated artifacts with schema validation.

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

## File Formats

### .attest.json Schema

Each generated artifact includes a cryptographic attestation file with the `.attest.json` extension:

```json
{
  "artifact": {
    "path": "./generated/output.js",
    "contentHash": "sha256:a7e35700290a69e4ac9ccbab995ec67933cb763b39e1aac0fd4f344b91ce37c8",
    "size": 2048,
    "mimeType": "application/javascript"
  },
  "generation": {
    "template": "base",
    "templatePath": "_templates/base.njk",
    "templateHash": "sha256:...",
    "context": {
      "name": "UserService",
      "type": "service"
    },
    "contextHash": "sha256:...",
    "graphFile": "sample.ttl",
    "graphHash": "sha256:..."
  },
  "environment": {
    "generatedAt": "2024-01-01T00:00:00.000Z",
    "kgenVersion": "1.0.0",
    "nodeVersion": "v18.0.0",
    "platform": "darwin",
    "arch": "x64",
    "staticBuildTime": "2024-01-01T00:00:00.000Z"
  },
  "verification": {
    "reproducible": true,
    "deterministic": true,
    "verified": true,
    "verificationCount": 3
  },
  "provenance": {
    "generator": "kgen-cli",
    "method": "deterministic-template-rendering",
    "inputs": [
      {
        "type": "template",
        "path": "_templates/base.njk",
        "hash": "sha256:..."
      },
      {
        "type": "graph",
        "path": "sample.ttl", 
        "hash": "sha256:..."
      }
    ]
  },
  "signatures": {
    "contentSignature": "...",
    "attestationSignature": "...",
    "algorithm": "ed25519"
  }
}
```

### SHACL Validation JSON Error Format

When SHACL validation fails, errors are returned in this structured format:

```json
{
  "success": false,
  "operation": "validate:artifacts",
  "error": "SHACL validation failed",
  "shaclResults": [
    {
      "severity": "sh:Violation",
      "focusNode": "ex:Person1",
      "sourceShape": "ex:PersonShape",
      "sourceConstraint": "sh:datatype",
      "resultPath": "foaf:age",
      "value": "invalid-age",
      "message": "Value is not of datatype xsd:integer"
    }
  ],
  "summary": {
    "totalViolations": 1,
    "errorCount": 1,
    "warningCount": 0
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### kgen.lock.json Format

Project lockfiles ensure reproducible builds:

```json
{
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "directory": ".",
  "files": {
    "sample.ttl": {
      "hash": "sha256:...",
      "size": 1497,
      "modified": "2024-01-01T00:00:00.000Z"
    }
  },
  "config": {
    "directories": {
      "templates": "_templates",
      "out": "./generated",
      "state": "./.kgen/state"
    },
    "drift": {
      "onDrift": "fail",
      "exitCode": 3
    }
  }
}
```

## Configuration

KGEN uses c12-based configuration with `kgen.config.js`:

```javascript
export default {
  directories: {
    out: './generated',
    state: './.kgen/state', 
    cache: './.kgen/cache',
    templates: '_templates',
    rules: './rules',
    knowledge: './knowledge'
  },
  generate: {
    defaultTemplate: 'base',
    attestByDefault: true,
    enableContentAddressing: true,
    staticBuildTime: '2024-01-01T00:00:00.000Z',
    enableCaching: true
  },
  drift: {
    onDrift: 'fail',
    exitCode: 3,
    tolerance: 0.95
  },
  impact: {
    maxBlastRadius: 5,
    includeInverseRelationships: true
  }
}
```

## Template Package Contract

Templates must follow this frontmatter structure:

```yaml
---
to: "{{ outputPath }}/{{ name }}.{{ extension }}"
inject: false
skipIf: "{{ skipCondition }}"
chmod: "755"
sh: "npm install {{ dependencies }}"
---
Template content with {{ variables }}
```

**Frontmatter Properties:**
- `to`: Output file path (supports template variables)
- `inject`: Boolean - whether to inject into existing file
- `skipIf`: Condition to skip generation
- `chmod`: File permissions for generated artifact
- `sh`: Shell command to run after generation

## Content Addressing System (CAS)

KGEN implements content-addressed storage for reproducible artifacts:

- **Content Hash**: SHA-256 of artifact content
- **Template Hash**: SHA-256 of template source
- **Context Hash**: SHA-256 of generation context
- **Composite Hash**: SHA-256 of (content + template + context)

```bash
# Generate with content addressing
kgen artifact generate --graph sample.ttl --template base --output ./generated

# Verify content addressing
kgen deterministic verify ./generated/output.js
```

## Error Handling

All commands return JSON output for machine consumption:

```json
{
  "success": false,
  "operation": "graph:hash",
  "error": "File not found: nonexistent.ttl",
  "errorCode": "FILE_NOT_FOUND",
  "exitCode": 1,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Version Compatibility

- **KGEN Version**: 1.0.0
- **Node.js**: >=18.0.0
- **RDF Formats**: Turtle, N-Triples, JSON-LD, RDF/XML
- **Template Engine**: Nunjucks
- **Schema Validation**: SHACL (via shacl-engine)

---

**Last Updated**: September 12, 2025  
**Implementation Version**: 1.0.0  
**Documentation Status**: Implementation Parity Complete