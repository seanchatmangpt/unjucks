# KGEN CLI Reference

Complete command-line interface reference for KGEN v1.0.0.

## Global Options

Available across all commands:

```bash
-d, --debug      Enable debug mode with verbose logging
-v, --verbose    Enable verbose output
-c, --config     Path to configuration file (default: kgen.config.js)
```

## Main Command

```bash
kgen [OPTIONS] <command>
```

**Description**: Knowledge Graph Engine for Deterministic Artifact Generation

## Commands Overview

| Command | Purpose |
|---------|---------|
| [graph](#graph-commands) | Graph operations for knowledge graph processing |
| [artifact](#artifact-commands) | Artifact generation and management |
| [project](#project-commands) | Project lifecycle management |
| [templates](#template-commands) | Template discovery and management |
| [rules](#rules-commands) | Reasoning rules management |
| [deterministic](#deterministic-commands) | Deterministic template rendering operations |
| [cache](#cache-commands) | Manage content-addressed cache |
| [drift](#drift-commands) | Drift detection (alias for artifact drift) |
| [validate](#validate-commands) | Comprehensive validation system |
| [query](#query-commands) | SPARQL query capabilities |
| [generate](#generate-commands) | Document and report generation |

---

## Graph Commands

Operations for processing RDF knowledge graphs.

### `graph hash <file>`

Generate canonical SHA256 hash of an RDF graph.

```bash
kgen graph hash test-graph.ttl
```

**Arguments**:
- `<file>` - Path to RDF/Turtle file

**Output**: JSON with hash, size, and metadata

**Example Output**:
```json
{
  "success": true,
  "file": "test-graph.ttl",
  "hash": "a1b2c3d4...",
  "size": 1024,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `graph diff <graph1> <graph2>`

Compare two RDF graphs and show semantic differences.

```bash
kgen graph diff old-schema.ttl new-schema.ttl
```

**Arguments**:
- `<graph1>` - First graph file
- `<graph2>` - Second graph file

**Output**: Detailed impact analysis including changes, blast radius, and recommendations

### `graph index <file>`

Build searchable index of RDF graph with triple analysis.

```bash
kgen graph index knowledge-base.ttl
```

**Arguments**:
- `<file>` - Path to RDF/Turtle file

**Output**: Index statistics with subjects, predicates, and objects

---

## Artifact Commands

Generate and manage deterministic artifacts from knowledge graphs.

### `artifact generate`

Generate deterministic artifacts from knowledge graphs.

```bash
kgen artifact generate -g schema.ttl -t api-service -o ./output
```

**Options**:
- `-g, --graph <path>` - Path to RDF/Turtle graph file
- `-t, --template <name>` - Template to use for generation
- `-o, --output <dir>` - Output directory

**Features**:
- Deterministic byte-for-byte reproduction
- Automatic attestation generation
- Semantic enrichment from RDF data
- Content-addressed caching

### `artifact drift <directory>`

Detect drift between expected and actual artifacts.

```bash
kgen artifact drift ./generated
```

**Arguments**:
- `<directory>` - Directory to check for drift

**Exit Codes**:
- `0` - No drift detected
- `3` - Drift detected (configurable via `drift.exitCode`)

**Output**: Drift report with recommendations

### `artifact explain <artifact>`

Explain artifact generation with provenance data.

```bash
kgen artifact explain ./generated/api-service.js
```

**Arguments**:
- `<artifact>` - Path to artifact file

**Output**: Complete provenance chain including:
- Template and context hashes
- Generation environment
- Verification status
- Reproducibility confirmation

---

## Project Commands

Manage project lifecycle with lockfiles and attestations.

### `project lock [directory]`

Generate lockfile for reproducible builds.

```bash
kgen project lock .
```

**Options**:
- `[directory]` - Project directory (default: current)

**Output**: Creates `kgen.lock.json` with file hashes and metadata

### `project attest [directory]`

Create cryptographic attestation bundle for entire project.

```bash
kgen project attest .
```

**Options**:
- `[directory]` - Project directory (default: current)

**Output**: Creates timestamped attestation with integrity verification

---

## Template Commands

Discover and analyze available templates.

### `templates ls`

List available templates.

```bash
kgen templates ls -v
```

**Options**:
- `-v, --verbose` - Show detailed template information including variables and frontmatter

**Output**: Template catalog with metadata

### `templates show <template>`

Show detailed template analysis.

```bash
kgen templates show api-service
```

**Arguments**:
- `<template>` - Template name to analyze

**Output**: Complete template analysis including:
- Variable extraction
- Structure analysis
- Frontmatter parsing
- Complexity metrics

---

## Rules Commands

Manage reasoning rules for semantic processing.

### `rules ls`

List available reasoning rules.

```bash
kgen rules ls
```

**Output**: Available rules with metadata

### `rules show <rule>`

Show detailed rule analysis.

```bash
kgen rules show validation
```

**Arguments**:
- `<rule>` - Rule name to analyze

**Output**: Rule content, prefixes, and analysis

---

## Deterministic Commands

Advanced deterministic rendering operations.

### `deterministic render <template>`

Render template with deterministic output.

```bash
kgen deterministic render api-template.njk -c '{"service":"users"}' -o service.js
```

**Options**:
- `-c, --context <json>` - JSON context for template
- `-o, --output <file>` - Output file path
- `-r, --rdf <content>` - RDF content for semantic enrichment

### `deterministic generate <template>`

Generate deterministic artifact with attestation.

```bash
kgen deterministic generate api-template.njk -c '{"service":"users"}' -o service.js
```

**Options**:
- `-c, --context <json>` - JSON context for template
- `-o, --output <file>` - Output file path

### `deterministic validate <template>`

Validate template for deterministic rendering.

```bash
kgen deterministic validate _templates/api-service.njk
```

**Output**: Deterministic score, issues, and recommendations

### `deterministic verify <artifact>`

Verify artifact reproducibility.

```bash
kgen deterministic verify ./generated/service.js --iterations 5
```

**Options**:
- `--iterations <n>` - Number of verification iterations (default: 3)

### `deterministic status`

Get system status and statistics.

```bash
kgen deterministic status
```

**Output**: Health check and performance statistics

---

## Cache Commands

Manage content-addressed cache system.

```bash
kgen cache <subcommand>
```

Subcommands provided by cache management system for performance optimization.

---

## Drift Commands

Alternative access to drift detection.

### `drift detect <directory>`

Detect drift in artifacts (alias for `artifact drift`).

```bash
kgen drift detect ./generated
```

Same functionality as `artifact drift` command.

---

## Validate Commands

Comprehensive validation system.

### `validate artifacts <path>`

Validate generated artifacts.

```bash
kgen validate artifacts ./generated -r
```

**Options**:
- `-r, --recursive` - Recursively validate directories

### `validate graph <file>`

Validate RDF graphs.

```bash
kgen validate graph schema.ttl --shacl
```

**Options**:
- `--shacl` - Enable SHACL validation

### `validate provenance <artifact>`

Validate provenance chains and attestations.

```bash
kgen validate provenance ./generated/service.js
```

---

## Query Commands

SPARQL query capabilities.

### `query sparql`

Execute SPARQL queries against RDF graphs.

```bash
kgen query sparql -g knowledge-base.ttl -q "SELECT * WHERE { ?s ?p ?o }"
kgen query sparql -g knowledge-base.ttl -f query.sparql --format csv
```

**Options**:
- `-g, --graph <file>` - Path to RDF graph file (required)
- `-q, --query <sparql>` - SPARQL query string
- `-f, --file <path>` - Path to SPARQL query file
- `--format <type>` - Output format: json, turtle, csv (default: json)

---

## Generate Commands

Document and report generation.

### `generate docs`

Generate documentation from knowledge graphs.

```bash
kgen generate docs -g api-schema.ttl -t docs -o ./docs/api.md
```

**Options**:
- `-g, --graph <file>` - Path to RDF graph file (required)
- `-t, --template <name>` - Documentation template (default: docs)
- `-o, --output <file>` - Output file path

---

## Configuration Integration

All commands respect configuration from `kgen.config.js`:

```javascript
export default {
  directories: {
    out: './dist',           // Default output directory
    templates: '_templates', // Templates directory
    cache: '.kgen/cache'     // Cache directory
  },
  drift: {
    onDrift: 'fail',        // Action: 'warn', 'fail', 'ignore'
    exitCode: 3             // Exit code for drift detection
  },
  generate: {
    attestByDefault: true,  // Generate attestations by default
    defaultTemplate: 'base' // Default template name
  }
};
```

## Error Handling

KGEN provides structured error handling:

- **Success**: Exit code 0 with JSON success response
- **User Error**: Exit code 1 with error details
- **Drift Detected**: Configurable exit code (default: 3)
- **System Error**: Exit code 2 for internal failures

## Debug Mode

Enable debug mode for detailed troubleshooting:

```bash
kgen --debug graph hash test.ttl
kgen --debug --verbose artifact generate -g schema.ttl -t api
```

Debug mode provides:
- Step-by-step execution logging
- Configuration details
- Performance metrics
- Error stack traces

## JSON Output

All commands output structured JSON for programmatic usage:

```json
{
  "success": true,
  "operation": "graph:hash",
  "result": { /* command-specific data */ },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error format:
```json
{
  "success": false,
  "operation": "graph:hash",
  "error": "File not found: test.ttl",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```