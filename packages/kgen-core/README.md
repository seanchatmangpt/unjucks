# KGEN Core - Enhanced RDF Graph Engine

A high-performance, deterministic RDF graph processing engine designed for enterprise knowledge graph applications. Provides canonical graph hashing, normalization, diff operations, and subject-to-artifact indexing.

## Features

🔹 **Deterministic Graph Hashing** - SHA256 canonical hashing for reproducible graph signatures  
🔹 **Graph Normalization** - Byte-for-byte reproducible graph ordering and serialization  
🔹 **Triple-Level Diff Engine** - Detailed comparison between graph states  
🔹 **Subject-to-Artifact Indexing** - Efficient mapping of RDF subjects to code artifacts  
🔹 **Enterprise Performance** - Optimized caching and memory management  
🔹 **TypeScript Support** - Comprehensive type definitions for type safety  

## Installation

```bash
npm install @kgen/core
```

## Quick Start

```javascript
import { createRDFProcessor } from '@kgen/core';

// Initialize processor with deterministic mode
const processor = await createRDFProcessor({
  deterministic: true,
  hashAlgorithm: 'sha256'
});

// Parse RDF data
const result = await processor.parseRDF(rdfData, 'turtle');

// Compute deterministic hash
const hash = processor.computeGraphHash(result.quads);
console.log('Graph hash:', hash.sha256);

// Normalize for reproducibility
const normalized = processor.normalizeGraph(result.quads);

// Diff two graphs
const diff = processor.computeGraphDiff(sourceQuads, targetQuads);
console.log('Added triples:', diff.added.length);

// Index subjects to artifacts
const index = processor.buildGraphIndex(result.quads, {
  'http://example.org/user1': ['/api/users.js', '/tests/users.test.js']
});

// Find subjects by artifact
const subjects = processor.findSubjectsByArtifact('/api/users.js');

await processor.shutdown();
```

## Core API

### EnhancedRDFProcessor

The main class providing all graph processing capabilities.

#### Configuration

```javascript
const config = {
  deterministic: true,        // Enable deterministic operations
  hashAlgorithm: 'sha256',    // Hash algorithm for graph hashing
  parser: { /* N3 parser options */ },
  writer: { /* N3 writer options */ },
  sparql: { 
    maxResults: 10000,        // Max SPARQL query results
    endpoint: null            // Remote SPARQL endpoint
  },
  namespaces: {               // Custom namespace definitions
    'ex': 'http://example.org/'
  }
};

const processor = new EnhancedRDFProcessor(config);
await processor.initialize();
```

#### Graph Hashing

Compute deterministic SHA256 hash of any graph:

```javascript
const hash = processor.computeGraphHash(quads);
// Returns: {
//   sha256: 'a1b2c3d4e5f6...',
//   algorithm: 'sha256',
//   tripleCount: 42,
//   timestamp: Date,
//   canonical: true
// }
```

#### Graph Normalization

Create canonical ordering for reproducible operations:

```javascript
const normalized = processor.normalizeGraph(quads);
// Returns: {
//   triples: [...],           // Canonically ordered
//   serialization: '...',     // Canonical serialization
//   metadata: {
//     originalCount: 42,
//     normalizedCount: 42,
//     blankNodesRenamed: 2,
//     deterministic: true
//   }
// }
```

#### Graph Diff Engine

Compare graphs at triple level:

```javascript
const diff = processor.computeGraphDiff(sourceQuads, targetQuads);
// Returns: {
//   added: [...],           // New triples in target
//   removed: [...],         // Missing triples from source  
//   modified: [...],        // Changed triples (future)
//   statistics: {
//     totalSource: 20,
//     totalTarget: 25,
//     added: 8,
//     removed: 3,
//     common: 17,
//     similarity: 0.68
//   }
// }
```

#### Subject-to-Artifact Indexing

Map RDF subjects to code artifacts:

```javascript
const artifactMap = {
  'https://example.org/user': ['/api/users.js', '/tests/users.test.js'],
  'https://example.org/order': ['/api/orders.js']
};

const index = processor.buildGraphIndex(quads, artifactMap);

// Query by subject
const entry = processor.getIndexEntry('https://example.org/user');
// Returns: {
//   subject: NamedNode,
//   artifacts: Set(['/api/users.js', '/tests/users.test.js']),
//   triples: [...],
//   predicates: Set(['http://xmlns.com/foaf/0.1/name', ...]),
//   objectTypes: Set(['NamedNode', 'Literal']),
//   lastUpdated: Date
// }

// Find by artifact
const subjects = processor.findSubjectsByArtifact('/api/users.js');
// Returns: [{
//   subject: 'https://example.org/user',
//   tripleCount: 5,
//   predicates: ['foaf:name', 'foaf:email']
// }]
```

### Utility Functions

#### RDF Validation

```javascript
import { validateRDF } from '@kgen/core';

const result = await validateRDF(rdfContent, 'turtle');
if (result.success) {
  console.log(`Valid RDF with ${result.tripleCount} triples`);
} else {
  console.error(`Invalid RDF: ${result.error}`);
}
```

## Performance Features

### Caching
- **Hash Cache**: Deterministic hash results cached for identical graphs
- **Normalization Cache**: Normalized forms cached for repeated operations
- **Configurable**: Caching can be disabled for memory-constrained environments

### Memory Management
- **Streaming Parsing**: Large RDF files processed in chunks
- **Lazy Evaluation**: Operations computed on-demand
- **Memory Monitoring**: Built-in memory usage tracking

### Statistics & Monitoring

```javascript
const stats = processor.getStats();
// Returns comprehensive statistics:
// {
//   store: { totalTriples, graphs, subjects, predicates, objects },
//   index: { indexedSubjects, totalArtifacts },
//   caches: { hashCacheSize, normalizedCacheSize },
//   metrics: { triplesProcessed, hashesComputed, ... },
//   status: 'ready',
//   deterministic: true
// }

const health = await processor.healthCheck();
// Returns health metrics including memory usage and cache efficiency
```

## Advanced Usage

### Custom Namespace Management

```javascript
processor.addNamespace('kgen', 'https://kgen.io/ontology#');
processor.removeNamespace('unused');
const uri = processor.getNamespace('kgen');
const all = processor.getNamespaces();
```

### Event Handling

```javascript
processor.on('hash-computed', (result) => {
  console.log('Hash computed:', result.sha256);
});

processor.on('graph-normalized', (metadata) => {
  console.log('Graph normalized:', metadata.normalizedCount, 'triples');
});

processor.on('diff-computed', (stats) => {
  console.log('Diff completed:', stats.similarity);
});
```

### Deterministic Serialization

```javascript
// Always produces identical output for same graph
const turtle1 = await processor.serializeRDF(quads, 'turtle');
const turtle2 = await processor.serializeRDF(quads, 'turtle');
console.log('Identical:', turtle1 === turtle2); // true
```

## TypeScript Support

Full TypeScript definitions included:

```typescript
import { EnhancedRDFProcessor, GraphHash, NormalizedGraph, GraphDiff } from '@kgen/core';

const processor: EnhancedRDFProcessor = await createRDFProcessor();
const hash: GraphHash = processor.computeGraphHash(quads);
const diff: GraphDiff = processor.computeGraphDiff(source, target);
```

## Supported RDF Formats

- **Turtle** (.ttl) - Default, highly recommended
- **N-Triples** (.nt) - Simple triple format  
- **N-Quads** (.nq) - Quad format with graphs
- **RDF/XML** (.rdf, .xml) - XML serialization
- **JSON-LD** (.jsonld) - JSON-based format

## Examples

See the `demo.js` file for a comprehensive demonstration of all features.

```bash
cd packages/kgen-core
node demo.js
```

## Testing

```bash
npm test
```

The test suite includes:
- ✅ Deterministic hashing validation
- ✅ Graph normalization reproducibility  
- ✅ Diff engine accuracy
- ✅ Index operations
- ✅ Error handling
- ✅ Memory management
- ✅ Performance benchmarks

## Performance Benchmarks

Typical performance on modern hardware:
- **Parsing**: 50,000+ triples/second
- **Hashing**: 10,000+ triples/second (cached: instant)
- **Normalization**: 15,000+ triples/second
- **Diff Operations**: 5,000+ triples/second
- **Memory**: ~200 bytes per triple

## Use Cases

- **Knowledge Graph Management**: Reproducible graph operations
- **Code Generation Provenance**: Track generated artifacts to RDF sources
- **Graph Versioning**: Detect and analyze changes between graph versions
- **Compliance & Auditing**: Deterministic hashing for verification
- **Enterprise Integration**: High-performance RDF processing at scale

## License

MIT - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

---

Built with ❤️ for the KGEN knowledge graph ecosystem.