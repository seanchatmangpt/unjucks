# KGEN SHACL Validation System

## Overview

The KGEN SHACL Validation System is a complete replacement of mixed validation approaches with a pure, deterministic SHACL-only validation system. This system uses `shacl-engine`, `rdf-ext`, and `clownface` to provide fast, reliable validation with comprehensive build gates and JSON-only reporting.

## Architecture

### Core Components

1. **SHACL Validation Engine** (`/src/kgen/validation/shacl-validation-engine.js`)
   - Pure SHACL validation using `shacl-engine`
   - Performance targets: ≤20ms typical, ≤100ms large graphs, ≤5ms reporting
   - JSON-only violation reporting
   - Comprehensive error handling and timeout management

2. **SHACL Gates** (`/src/kgen/validation/shacl-gates.js`)
   - Build-blocking validation gates
   - CLI integration with proper exit codes
   - Gate types: pre-build, artifact-generation, post-build, release
   - Configurable blocking behavior (violations, warnings)

3. **Performance Optimizer** (`/src/kgen/validation/performance-optimizer.js`)
   - Validation caching and result memoization
   - Parallel validation for large graphs
   - Incremental validation support
   - Memory management and garbage collection

4. **CLI Integration** (`/src/kgen/validation/shacl-cli-integration.js`)
   - Command-line interface for all SHACL operations
   - Integration with KGEN CLI commands
   - Batch processing and reporting

5. **SHACL Shapes** (`/src/kgen/validation/shapes/`)
   - Comprehensive shapes for KGEN ontology
   - Template constraint shapes
   - Security and performance validation shapes

## Performance Targets

| Operation | Target Time | Implementation |
|-----------|-------------|----------------|
| Standard validation | ≤20ms | SHACL engine with optimized shapes |
| Large graphs (10k+ triples) | ≤100ms | Parallel processing and caching |
| Violation reporting | ≤5ms | Efficient JSON serialization |
| Shape compilation | ≤50ms | Precompiled shape caching |

## SHACL Shapes

### Core Ontology Shapes (`kgen-attest-shapes.ttl`)

- **ArtifactShape**: Validates generated artifacts
  - Required: identifier, creation timestamp, checksum, generator activity
  - Constraints: SHA-256 checksums, valid identifiers, non-negative sizes
  
- **TemplateShape**: Validates templates
  - Required: name, content, supported engines
  - Syntax validation for Nunjucks templates
  - Security validation for dangerous constructs

- **ProvenanceShape**: PROV-O compliant validation
  - Activity timing constraints
  - Agent identification requirements
  - Entity usage relationships

- **AttestationShape**: Cryptographic attestations
  - Digital signatures and algorithms
  - Public key validation
  - Integrity measurements

### Template Constraints (`template-constraints.ttl`)

- **Nunjucks syntax validation**: Balanced brackets, closed control structures
- **Security constraints**: Prevention of code injection and dangerous constructs
- **Frontmatter validation**: Path traversal protection, valid injection modes
- **Variable validation**: Naming conventions, reserved keywords, type safety

### Performance Shapes

- **Large graph warnings**: Performance impact notifications
- **Complexity analysis**: Template and shape complexity scoring
- **Resource usage monitoring**: Memory and processing time tracking

## Validation Gates

### Gate Types

1. **Pre-Build Gate** (`PRE_BUILD`)
   - Validates input data before artifact generation
   - Blocks on violations, allows warnings
   - Required for build to proceed

2. **Artifact Generation Gate** (`ARTIFACT_GENERATION`)
   - Validates generated artifacts
   - Ensures semantic correctness
   - Blocks on violations

3. **Post-Build Gate** (`POST_BUILD`)
   - Quality assurance validation
   - Informational only, doesn't block
   - Generates quality metrics

4. **Release Gate** (`RELEASE`)
   - Strictest validation for releases
   - Blocks on both violations and warnings
   - Full attestation and provenance validation

### Gate Configuration

```javascript
const gateConfig = {
  blockOnViolations: true,    // Block build on SHACL violations
  blockOnWarnings: false,     // Allow warnings to pass
  timeout: 30000,             // 30 second timeout
  required: true              // Gate must pass for build success
};
```

## CLI Integration

### Commands

```bash
# Basic validation
kgen shacl validate data.ttl --shapes shapes/ --format json

# Run specific gate
kgen shacl gates pre-build data.ttl --block-violations

# Run all gates
kgen shacl all-gates ./data-directory --format json --output reports/

# Validate SHACL shapes themselves
kgen shacl check-shapes shapes.ttl --details

# Performance analysis
kgen shacl validate data.ttl --performance --trace
```

### Exit Codes

- `0`: Success or warnings only
- `1`: Validation errors (system failures)
- `2`: Critical system errors
- `3`: SHACL violations (constraint failures)

## JSON Reporting

### Validation Report Format

```json
{
  "conforms": false,
  "timestamp": "2024-09-12T10:30:00.000Z",
  "violations": [
    {
      "focusNode": "ex:invalidArtifact",
      "resultPath": "kgen:hasChecksum", 
      "sourceShape": "ex:ArtifactShape",
      "severity": "Violation",
      "message": "Artifact must have exactly one SHA-256 checksum",
      "value": null
    }
  ],
  "summary": {
    "totalViolations": 1,
    "violationsBySeverity": {
      "Violation": 1,
      "Warning": 0,
      "Info": 0
    },
    "performance": {
      "validationTime": "15.23ms",
      "reportingTime": "2.15ms", 
      "graphSize": 1247,
      "shapesCount": 12
    }
  }
}
```

### Gate Report Format

```json
{
  "gate": {
    "gateName": "pre-build",
    "blocked": false,
    "passed": true,
    "conforms": true,
    "violations": 0,
    "exitCode": 0,
    "performance": {
      "validationTime": "18.45ms"
    },
    "timestamp": "2024-09-12T10:30:00.000Z"
  },
  "validation": {
    // Full validation report included
  }
}
```

## Performance Optimization

### Caching Strategy

1. **Validation Result Caching**
   - Cache validation results by graph hash
   - TTL-based expiration (5 minutes default)
   - LRU eviction for memory management

2. **Shape Compilation Caching**
   - Precompiled SHACL shapes with analysis
   - Index generation for fast constraint lookup
   - Constraint ordering optimization

3. **Graph Processing Optimization**
   - Parallel validation for large graphs
   - Incremental validation for graph changes
   - Memory-efficient streaming for huge datasets

### Memory Management

- Configurable memory limits (default: 512MB)
- Automatic garbage collection triggers
- Cache size limits with LRU eviction
- Resource cleanup on shutdown

## Migration from Legacy Validation

### Backward Compatibility

The system maintains backward compatibility through:

1. **Export Mapping**: `ValidationExitCodes` mapped to `SHACLValidationCodes`
2. **Interface Preservation**: Existing validation interfaces redirect to SHACL
3. **Gradual Migration**: Old validation code marked deprecated with migration paths

### Replacement Strategy

1. **Phase 1**: Install SHACL system alongside existing validation
2. **Phase 2**: Route validation calls to SHACL engine
3. **Phase 3**: Remove legacy validation code
4. **Phase 4**: Optimize SHACL system for production

## Usage Examples

### Basic Validation

```javascript
import { SHACLValidationEngine } from './shacl-validation-engine.js';

const engine = new SHACLValidationEngine();
await engine.loadShapes('./shapes/kgen-attest-shapes.ttl');

const report = await engine.validate(rdfData);
if (!report.conforms) {
  console.error(`Validation failed with ${report.violations.length} violations`);
  process.exit(3);
}
```

### Gate Integration

```javascript
import { SHACLGates } from './shacl-gates.js';

const gates = new SHACLGates({ 
  reportPath: './validation-reports',
  exitOnFailure: true 
});
await gates.initialize('./shapes');

const result = await gates.runGate('pre-build', rdfData);
// Gate will automatically exit with appropriate code if blocked
```

### Performance Optimization

```javascript
import { SHACLPerformanceOptimizer } from './performance-optimizer.js';

const optimizer = new SHACLPerformanceOptimizer({
  enableCaching: true,
  maxWorkers: 4
});

const optimizedValidation = optimizer.optimizeValidation(
  async (data) => engine.validate(data)
);

const report = await optimizedValidation(rdfData);
```

## Testing

The system includes comprehensive tests covering:

- **Performance targets**: Validation time limits
- **Correctness**: SHACL constraint validation
- **Error handling**: Timeout and failure scenarios  
- **CLI integration**: Command-line interface testing
- **Gate functionality**: Build blocking behavior
- **Optimization**: Caching and performance features

Run tests with:

```bash
npm test tests/kgen/validation/
```

## Security Considerations

1. **Input validation**: All RDF inputs validated before processing
2. **Path traversal protection**: Safe file path handling
3. **Resource limits**: Memory and time limits prevent DoS
4. **Code injection prevention**: Template security validation
5. **Cryptographic validation**: Signature and hash verification

## Future Enhancements

1. **Distributed validation**: Multi-node SHACL processing
2. **Advanced caching**: Redis-based distributed caching
3. **Machine learning**: Constraint optimization through ML
4. **Real-time validation**: WebSocket-based live validation
5. **Visual reporting**: SVG/HTML validation reports

---

The KGEN SHACL Validation System provides a robust, performant, and standards-compliant foundation for semantic validation in the KGEN ecosystem, replacing ad-hoc validation approaches with a unified, deterministic system.