# kgen Graph Operations

This module implements the core graph processing functionality for kgen, providing deterministic, canonical operations on RDF graphs as specified in the PRD.

## Modules

### HashCalculator (`hash-calculator.js`)
- **Purpose**: Canonical SHA256 hashing for .ttl files
- **Features**:
  - Deterministic hash calculation regardless of input order
  - Blank node normalization
  - Triple sorting for consistency
  - Hash validation and comparison
- **CLI Command**: `kgen graph hash <file.ttl>`

### DiffAnalyzer (`diff-analyzer.js`)
- **Purpose**: Delta calculation with blast radius analysis
- **Features**:
  - Comprehensive diff analysis (triple, subject, predicate levels)
  - Blast radius calculation
  - Semantic diff analysis
  - Impact pattern identification
- **CLI Command**: `kgen graph diff <original.ttl> <modified.ttl>`

### IndexBuilder (`index-builder.js`)
- **Purpose**: Subject-to-artifact mapping and graph indexing
- **Features**:
  - Multi-level indexing (subjects, predicates, objects, namespaces, semantic)
  - Subject-to-artifact mapping
  - Graph traversal and relationship analysis
  - Search capabilities
- **CLI Command**: `kgen graph index <file.ttl>`

### ImpactCalculator (`impact-calculator.js`)
- **Purpose**: Change impact analysis for graph modifications
- **Features**:
  - Blast radius calculation with weighted impact scoring
  - Risk assessment for changes
  - Dependency impact analysis
  - Artifact impact calculation
  - Comprehensive impact reporting
- **CLI Command**: `kgen graph impact <original.ttl> <modified.ttl>`

## Key Features from PRD

### ✅ Canonical, Deterministic SHA256 Hash
```javascript
import { HashCalculator } from './graph/hash-calculator.js';

const calculator = new HashCalculator();
const result = await calculator.calculateTTLHash(ttlContent);
// result.hash is always the same for equivalent graphs
```

### ✅ Calculate Blast Radius Without Full Build
```javascript
import { ImpactCalculator } from './graph/impact-calculator.js';

const calculator = new ImpactCalculator({ maxBlastRadius: 10 });
const impact = await calculator.calculateChangeImpact(originalTTL, modifiedTTL);
// impact.blastRadius contains affected subjects and their distances
```

### ✅ Subject-to-Artifact Mapping
```javascript
import { IndexBuilder } from './graph/index-builder.js';

const builder = new IndexBuilder();
const mapping = await builder.buildSubjectToArtifactMapping(ttlContent, artifacts);
// mapping.subjectToArtifacts maps each subject to its artifacts
```

## Usage Examples

### Basic Hash Calculation
```javascript
import { calculateGraphHash } from './graph/index.js';

const hashResult = await calculateGraphHash(ttlContent, {
  algorithm: 'sha256',
  normalizeBlankNodes: true,
  sortTriples: true
});

console.log(`Graph hash: ${hashResult.hash}`);
console.log(`Triple count: ${hashResult.metadata.tripleCount}`);
```

### Comprehensive Diff Analysis
```javascript
import { calculateGraphDiff } from './graph/index.js';

const diffResult = await calculateGraphDiff(originalTTL, modifiedTTL, {
  calculateBlastRadius: true,
  includeSemanticDiff: true,
  maxBlastRadius: 5
});

console.log(`Total changes: ${diffResult.summary.totalChanges}`);
console.log(`Blast radius: ${diffResult.blastRadius.maxRadius}`);
console.log(`Affected subjects: ${diffResult.blastRadius.totalAffected}`);
```

### Impact Analysis with Risk Assessment
```javascript
import { calculateGraphImpact } from './graph/index.js';

const impactResult = await calculateGraphImpact(originalTTL, modifiedTTL, {
  calculateArtifactImpact: true,
  enableSemanticAnalysis: true,
  artifactMappings: existingMappings
});

console.log(`Risk level: ${impactResult.riskAssessment.level}`);
console.log(`Impact score: ${impactResult.impactScore.overall}`);
console.log(`Affected artifacts: ${impactResult.artifactImpact?.summary.affectedArtifacts || 0}`);
```

### Complete Graph Analysis Pipeline
```javascript
import { analyzeGraph } from './graph/index.js';

const analysis = await analyzeGraph(originalTTL, modifiedTTL, {
  hash: { normalizeBlankNodes: true },
  diff: { calculateBlastRadius: true },
  index: { enableArtifactMapping: true },
  impact: { enableSemanticAnalysis: true }
});

// Analysis contains:
// - analysis.original.hash
// - analysis.modified.hash  
// - analysis.diff
// - analysis.impact
// - analysis.hashComparison
```

### Batch Operations
```javascript
import { batchGraphOperations } from './graph/index.js';

const operations = [
  { id: 'hash1', type: 'hash', ttlContent: ttl1 },
  { id: 'hash2', type: 'hash', ttlContent: ttl2 },
  { id: 'diff1', type: 'diff', originalTTL: ttl1, modifiedTTL: ttl2 }
];

const results = await batchGraphOperations(operations);
// Process results array
```

## Configuration

### Default Configuration
```javascript
const config = {
  hash: {
    algorithm: 'sha256',
    encoding: 'hex',
    normalizeBlankNodes: true,
    sortTriples: true,
    ignoreGraphNames: false
  },
  diff: {
    includeBlankNodes: true,
    includeGraphContext: true,
    calculateBlastRadius: true,
    maxBlastRadius: 10,
    includeSemanticDiff: true,
    diffGranularity: 'triple'
  },
  index: {
    enableSemanticIndexing: true,
    enablePredicateIndexing: true,
    enableNamespaceIndexing: true,
    enableArtifactMapping: true,
    maxDepthTraversal: 5,
    cacheIndexes: true
  },
  impact: {
    maxBlastRadius: 5,
    includeInverseRelationships: true,
    calculateArtifactImpact: true,
    weightedImpactScoring: true,
    enableSemanticAnalysis: true,
    impactThreshold: 0.1
  }
};
```

## Performance Considerations

### Hash Calculation
- **Time Complexity**: O(n log n) for n triples (due to sorting)
- **Space Complexity**: O(n) for storing and processing triples
- **Optimizations**: Blank node normalization cache, incremental hashing

### Diff Analysis
- **Time Complexity**: O(n + m) for n original and m modified triples
- **Space Complexity**: O(n + m) for storing both graphs
- **Optimizations**: String-based comparison, early termination for identical graphs

### Index Building
- **Time Complexity**: O(n * k) for n triples and k index types
- **Space Complexity**: O(n * k) for storing multiple indexes
- **Optimizations**: Lazy index building, selective indexing based on query patterns

### Impact Calculation
- **Time Complexity**: O(n * d^r) for n subjects, d average degree, r blast radius
- **Space Complexity**: O(n * r) for storing impact paths
- **Optimizations**: Breadth-first traversal with early termination, impact threshold filtering

## Integration with Existing Code

The graph operations leverage existing algorithms from:

### From `src/kgen/provenance/queries/sparql.js`
- SPARQL query templates for lineage analysis
- Provenance-specific query patterns
- Query optimization strategies

### From `src/kgen/semantic/processor.js`
- RDF parsing and processing infrastructure
- Ontology metadata extraction
- Semantic reasoning patterns

### From `src/kgen/query/engine.js`
- Graph traversal algorithms
- Index optimization strategies
- Query result processing

## Error Handling

All modules implement comprehensive error handling:
- **Parse Errors**: Invalid TTL syntax detection and reporting
- **Processing Errors**: Graceful handling of malformed graphs
- **Resource Limits**: Protection against excessive memory usage
- **Timeout Handling**: Configurable timeouts for long-running operations

## Testing and Validation

Each module includes extensive test coverage:
- **Unit Tests**: Individual function testing with edge cases
- **Integration Tests**: End-to-end workflow validation
- **Performance Tests**: Scalability and performance validation
- **Compatibility Tests**: Cross-platform and format compatibility

## CLI Integration

These modules integrate with the kgen CLI commands:

```bash
# Hash calculation
kgen graph hash api-model.ttl --algorithm sha256 --normalize

# Diff analysis  
kgen graph diff original.ttl modified.ttl --blast-radius 5 --format json

# Index building
kgen graph index knowledge-base.ttl --artifacts artifacts.json --semantic

# Impact analysis
kgen graph impact old.ttl new.ttl --risk-assessment --artifacts artifacts.json
```

All commands support:
- JSON output format for machine processing
- Configurable verbosity levels
- Exit codes for CI/CD integration
- Progress reporting for large graphs