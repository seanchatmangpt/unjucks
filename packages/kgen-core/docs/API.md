# KGEN Core RDF API Documentation

## Overview

KGEN Core provides production-ready RDF processing capabilities with deterministic hashing, content addressing, and byte-for-byte reproducible serialization. The library is designed for CLI integration and enterprise-grade graph operations.

## Installation

```bash
npm install @kgen/core
```

## Quick Start

```javascript
import { RDFCore } from '@kgen/core';

const rdf = new RDFCore({
  enableCaching: true,
  defaultFormat: 'turtle'
});

// Parse and add RDF data
await rdf.add(`
  @prefix ex: <http://example.org/> .
  ex:subject ex:predicate "object" .
`, 'turtle');

// Calculate content hash
const hash = rdf.calculateHash();
console.log('Content hash:', hash);

// Serialize to different formats
const turtle = await rdf.serialize(null, 'turtle');
const jsonld = await rdf.serialize(null, 'jsonld');

// Create content-addressed identifier
const contentId = rdf.createContentId();
console.log('Content ID:', contentId);
```

## Core Classes

### RDFCore

Main entry point that combines all RDF functionality.

#### Constructor

```javascript
const rdf = new RDFCore(config)
```

**Config Options:**
- `enableCaching` (boolean): Enable result caching (default: true)
- `maxCacheSize` (number): Maximum cache size (default: 10000)
- `defaultFormat` (string): Default RDF format (default: 'turtle')
- `validateInputs` (boolean): Validate inputs (default: true)

#### Methods

##### `parse(data, format, options)`
Parse RDF data from string.

```javascript
const result = await rdf.parse(turtleData, 'turtle');
// Returns: { quads, count, format, parseTime, stats, prefixes }
```

##### `add(data, format, options)`
Add RDF data to the graph.

```javascript
const result = await rdf.add(data, 'turtle', { graph: 'http://example.org/graph' });
// Returns: { added, totalQuads, graph }
```

##### `serialize(quads, format, options)`
Serialize RDF graph to string.

```javascript
const turtle = await rdf.serialize(null, 'turtle', {
  prefixes: { ex: 'http://example.org/' }
});
```

##### `query(pattern, options)`
Query the RDF graph with pattern matching.

```javascript
const results = rdf.query({
  predicate: 'ex:predicate'
}, { limit: 10 });
```

##### `calculateHash(options)`
Calculate deterministic content hash.

```javascript
const hash = rdf.calculateHash({
  algorithm: 'sha256',
  normalization: 'rdf-dataset-canonical'
});
```

##### `createContentId(options)`
Create content-addressed identifier.

```javascript
const id = rdf.createContentId({
  prefix: 'kgen',
  version: 'v1'
});
```

##### `validate(data, format, options)`
Validate RDF data.

```javascript
const result = await rdf.validate(data, 'turtle');
// Returns: { isValid, errors, warnings, stats }
```

##### `export(format, options)`
Export graph with complete metadata.

```javascript
const exported = await rdf.export('turtle');
// Returns: { data, format, hash, contentId, stats, timestamp, metadata }
```

##### `diff(other)`
Compare two RDF graphs.

```javascript
const diff = rdf.diff(otherRDF);
// Returns: { added, removed, common, addedQuads, removedQuads }
```

##### `merge(other, options)`
Merge another RDF graph.

```javascript
const result = rdf.merge(otherRDF);
// Returns: { merged, totalQuads, source }
```

### GraphProcessor

Core RDF graph operations and storage.

```javascript
import { GraphProcessor } from '@kgen/core/graph-processor';

const processor = new GraphProcessor({
  enableCaching: true,
  maxTriples: 1000000
});

// Parse RDF
const result = await processor.parseRDF(data, 'turtle');

// Add/remove quads
processor.addQuads(quads);
processor.removeQuads(quads);

// Query with patterns
const matches = processor.query({ subject: 'http://example.org/s' });

// Calculate content hash
const hash = processor.calculateContentHash();
```

### NamespaceManager

Prefix and namespace URI management.

```javascript
import { NamespaceManager } from '@kgen/core/namespace-manager';

const ns = new NamespaceManager({
  prefixes: { ex: 'http://example.org/' }
});

// Add/remove prefixes
ns.addPrefix('custom', 'http://custom.org/');
ns.removePrefix('custom');

// Expand/compact URIs
const expanded = ns.expand('ex:resource');
const compacted = ns.compact('http://example.org/resource');

// Batch operations
const expandedAll = ns.expandAll(['ex:r1', 'ex:r2']);
const compactedAll = ns.compactAll(['http://example.org/r1', 'http://example.org/r2']);
```

### RDFSerializers

Multi-format RDF serialization with deterministic output.

```javascript
import { RDFSerializers } from '@kgen/core/serializers';

const serializers = new RDFSerializers({
  deterministic: true,
  prettyPrint: true
});

// Serialize to various formats
const turtle = await serializers.serialize(quads, 'turtle');
const ntriples = await serializers.serialize(quads, 'ntriples');
const jsonld = await serializers.serialize(quads, 'jsonld');
const canonical = await serializers.serialize(quads, 'canonical');

// Calculate hash
const hash = await serializers.calculateHash(quads, 'canonical');

// Create content ID
const id = await serializers.createContentId(quads);

// Verify integrity
const isValid = serializers.verifyIntegrity(serialized, expectedHash);
```

### HashCalculator

Content-addressed hashing with deterministic graph fingerprinting.

```javascript
import { HashCalculator } from '@kgen/core/hash-calculator';

const hasher = new HashCalculator({
  algorithm: 'sha256',
  normalization: 'rdf-dataset-canonical'
});

// Calculate graph hash
const hash = hasher.calculateGraphHash(quads);

// Individual quad hash
const quadHash = hasher.calculateQuadHash(quad);

// Incremental hashing
const newHash = hasher.calculateIncrementalHash(oldHash, newQuads);

// Content identifiers
const contentId = hasher.createContentId(quads);

// Verify hash
const isValid = hasher.verifyHash(quads, expectedHash);
```

## Supported RDF Formats

### Input Formats
- **Turtle** (.ttl) - `turtle`
- **N-Triples** (.nt) - `ntriples`
- **N-Quads** (.nq) - `nquads`
- **RDF/XML** (.rdf, .xml) - `rdfxml`
- **JSON-LD** (.jsonld) - `jsonld`

### Output Formats
- **Turtle** - `turtle`
- **N-Triples** - `ntriples`
- **N-Quads** - `nquads`
- **JSON-LD** - `jsonld`
- **RDF/XML** - `rdfxml`
- **Canonical** - `canonical` (deterministic format for hashing)

## CLI Integration Examples

### Basic Graph Operations

```javascript
// CLI command: kgen graph parse <file>
import { RDFCore } from '@kgen/core';

export async function parseCommand(filePath, options) {
  const rdf = new RDFCore();
  const fs = await import('fs/promises');
  
  const data = await fs.readFile(filePath, 'utf8');
  const result = await rdf.parse(data, options.format);
  
  return {
    success: true,
    count: result.count,
    format: result.format,
    parseTime: result.parseTime
  };
}
```

### Content Hashing

```javascript
// CLI command: kgen graph hash <file>
export async function hashCommand(filePath, options) {
  const rdf = new RDFCore();
  const fs = await import('fs/promises');
  
  const data = await fs.readFile(filePath, 'utf8');
  await rdf.add(data, options.format);
  
  const hash = rdf.calculateHash({
    algorithm: options.algorithm || 'sha256'
  });
  
  const contentId = rdf.createContentId({
    prefix: options.prefix || 'kgen'
  });
  
  return {
    success: true,
    hash,
    contentId,
    algorithm: options.algorithm || 'sha256'
  };
}
```

### Graph Validation

```javascript
// CLI command: kgen graph validate <file>
export async function validateCommand(filePath, options) {
  const rdf = new RDFCore();
  const fs = await import('fs/promises');
  
  const data = await fs.readFile(filePath, 'utf8');
  const result = await rdf.validate(data, options.format, {
    checkNamespaces: options.checkNamespaces
  });
  
  return {
    success: result.isValid,
    isValid: result.isValid,
    errors: result.errors,
    warnings: result.warnings,
    stats: result.stats
  };
}
```

### Format Conversion

```javascript
// CLI command: kgen graph convert <input> <output> --format <format>
export async function convertCommand(inputPath, outputPath, options) {
  const rdf = new RDFCore();
  const fs = await import('fs/promises');
  
  const inputData = await fs.readFile(inputPath, 'utf8');
  await rdf.add(inputData, options.inputFormat);
  
  const outputData = await rdf.serialize(null, options.outputFormat, {
    prefixes: options.prefixes,
    deterministic: true
  });
  
  await fs.writeFile(outputPath, outputData, 'utf8');
  
  return {
    success: true,
    inputFormat: options.inputFormat,
    outputFormat: options.outputFormat,
    size: outputData.length
  };
}
```

## Configuration

### RDFCore Configuration

```javascript
const rdf = new RDFCore({
  // Core settings
  enableCaching: true,
  maxCacheSize: 10000,
  defaultFormat: 'turtle',
  validateInputs: true,
  
  // Component-specific configs
  graph: {
    maxTriples: 1000000,
    enableCaching: true
  },
  
  namespaces: {
    prefixes: {
      custom: 'http://custom.org/'
    },
    validateURIs: true
  },
  
  serializers: {
    deterministic: true,
    prettyPrint: true,
    compression: 'none'
  },
  
  hasher: {
    algorithm: 'sha256',
    normalization: 'rdf-dataset-canonical',
    blankNodeHandling: 'canonical'
  }
});
```

## Events

All classes extend EventEmitter and emit relevant events:

```javascript
// RDFCore events
rdf.on('quads-added', ({ count, graph }) => {
  console.log(`Added ${count} quads to ${graph}`);
});

rdf.on('prefix-added', ({ prefix, uri }) => {
  console.log(`Added namespace ${prefix}: ${uri}`);
});

// GraphProcessor events
processor.on('store-cleared', ({ graph }) => {
  console.log(`Cleared ${graph || 'default'} graph`);
});

// NamespaceManager events
namespaces.on('prefixes-imported', ({ count, source }) => {
  console.log(`Imported ${count} prefixes from ${source}`);
});
```

## Error Handling

All methods properly handle and propagate errors:

```javascript
try {
  await rdf.add(invalidData, 'turtle');
} catch (error) {
  if (error.message.includes('RDF Parse Error')) {
    console.error('Invalid RDF syntax:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Performance Considerations

1. **Caching**: Enable caching for repeated operations
2. **Batch Operations**: Process multiple quads at once
3. **Memory Management**: Clear caches periodically for long-running processes
4. **Deterministic Mode**: Disable for performance-critical non-reproducible operations

```javascript
// Performance optimization example
const rdf = new RDFCore({
  enableCaching: true,
  maxCacheSize: 50000
});

// Batch processing
const allQuads = await Promise.all(
  files.map(file => rdf.parseFile(file))
);

// Periodic cleanup
setInterval(() => {
  rdf.graph.cache.clear();
  rdf.hasher.clearCache();
}, 300000); // Every 5 minutes
```

## Testing

The library includes comprehensive tests covering all functionality:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## License

MIT License - see package.json for details.

## Contributing

This library is part of the KGEN project. Please refer to the main repository for contribution guidelines.