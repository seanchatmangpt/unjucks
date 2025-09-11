# KGEN Knowledge Graph Utilities Catalog

## Overview
This comprehensive catalog documents all knowledge graph utilities discovered in the KGEN project, providing file references, functionality descriptions, and usage examples for graph manipulation, traversal, querying, and visualization capabilities.

## 🔍 Discovery Summary
- **Total Files Scanned**: 20+ core files
- **Knowledge Graph Components**: 8 major components
- **Graph Algorithms**: 15+ implementations
- **Query Engines**: 3 specialized engines
- **Storage Backends**: Multi-backend support
- **Visualization Helpers**: Graph export formats

---

## 📁 Core Knowledge Graph Components

### 1. Query Engine (`src/kgen/query/engine.js`)

**Primary Class**: `QueryEngine` (lines 13-962)

**Core Functions**:
- `executeSPARQL(query, options)` (line 117) - Execute SPARQL queries with optimization
- `optimizeQuery(parsedQuery, options)` (line 203) - Query optimization algorithms  
- `createQueryPlan(parsedQuery)` (line 227) - Generate execution plans
- `performSemanticSearch(searchTerms, context)` (line 278) - Semantic search capabilities
- `analyzeQueryPerformance(query)` (line 335) - Performance analysis
- `generateInsights(graph)` (line 380) - Knowledge graph insights
- `detectPatterns(graph)` (line 423) - Pattern detection algorithms
- `calculateMetrics(graph)` (line 469) - Graph metrics calculation

**Key Features**:
- SPARQL query execution with caching (lines 129-137)
- Query optimization with cost estimation (lines 242-269)
- Real-time analytics and metrics collection (lines 65-76)
- Pattern detection with confidence scoring (lines 446-461)
- Index management for performance (lines 566-577)

### 2. Semantic Processor (`src/kgen/semantic/processor.js`)

**Primary Class**: `SemanticProcessor` (lines 17-2003)

**Graph Manipulation**:
- `loadOntology(source)` (line 98) - Load ontologies from various sources
- `alignSchemas(ontologies)` (line 153) - Multi-schema alignment  
- `performReasoning(graph, rules, options)` (line 199) - Semantic reasoning
- `validateGraph(graph, constraints, options)` (line 262) - Graph validation
- `enrichGenerationContext(graph, options)` (line 371) - Context enrichment

**Advanced Features**:
- OWL reasoning with subsumption (lines 1439-1497)
- SHACL validation (lines 1078-1115)
- Consistency checking (lines 1874-2002)
- Entity similarity calculation (lines 1602-1684)
- Pattern recognition (lines 1261-1291)

### 3. RDF Processor (`src/kgen/rdf/index.js`)

**Primary Class**: `RDFProcessor` (lines 13-527)

**Graph Operations**:
- `parseRDF(data, format, options)` (line 107) - Multi-format RDF parsing
- `addQuads(quads, graph)` (line 148) - Graph data insertion
- `removeQuads(quads, graph)` (line 170) - Graph data removal
- `query(sparql, options)` (line 189) - SPARQL query execution
- `serializeRDF(quads, format, options)` (line 331) - Multi-format export

**Query Execution**:
- `executeSelect(parsedQuery, options)` (line 228) - SELECT queries
- `executeConstruct(parsedQuery, options)` (line 273) - CONSTRUCT queries  
- `executeAsk(parsedQuery, options)` (line 285) - ASK queries
- `executeDescribe(parsedQuery, options)` (line 307) - DESCRIBE queries

---

## 🔍 Provenance & Lineage Systems

### 4. Provenance Tracker (`src/kgen/provenance/tracker.js`)

**Primary Class**: `ProvenanceTracker` (lines 22-1527)

**Lineage Functions**:
- `trackEntityLineage(entityId, lineageInfo)` (line 361) - Track data lineage
- `getEntityLineage(entityId, options)` (line 397) - Retrieve entity lineage
- `getAdvancedEntityLineage(entityId, options)` (line 1044) - Advanced lineage with analytics
- `analyzeChangeImpact(entityId, proposedChanges)` (line 1163) - Impact analysis
- `getVisualizationData(options)` (line 1215) - Graph visualization data

**Graph Visualization**:
- Node and edge extraction (lines 1219-1281)
- Cytoscape.js format support (line 1217)
- D3.js format conversion (lines 1494-1504)
- Graphviz DOT format (lines 1506-1524)

**Key Algorithms**:
- Upstream lineage traversal (line 903)
- Downstream lineage traversal (line 910)  
- Complete lineage graph building (line 917)
- Impact analysis with risk scoring (lines 1464-1493)

### 5. Provenance Queries (`src/kgen/provenance/queries/sparql.js`)

**Primary Class**: `ProvenanceQueries` (lines 15-751)

**Specialized Queries**:
- `getEntityLineage(entityUri, options)` (line 101) - Entity lineage queries
- `getActivityChain(entityUri, options)` (line 137) - Activity chain analysis
- `getInvolvedAgents(entityUri, options)` (line 155) - Agent involvement tracking
- `getTemporalProvenance(startDate, endDate, options)` (line 174) - Time-based queries

**Query Templates** (lines 312-477):
- Forward lineage traversal (lines 314-325)
- Backward lineage traversal (lines 327-338)
- Bidirectional lineage (lines 340-358)
- Activity chains (lines 360-376)
- Temporal analysis (lines 398-411)

---

## 💾 Storage & Indexing Systems

### 6. Provenance Storage (`src/kgen/provenance/storage/index.js`)

**Primary Class**: `ProvenanceStorage` (lines 18-376)

**Storage Functions**:
- `store(id, data, options)` (line 79) - Store provenance records
- `retrieve(id, options)` (line 125) - Retrieve records with decompression
- `list(filters)` (line 162) - Query stored records
- `backup(options)` (line 197) - Create storage backups

**Features**:
- Multi-backend support (file, database, object storage)
- Encryption and compression (lines 93-100, 134-144)
- Backup and restore capabilities (lines 197-229)
- Hierarchical file organization (lines 256-260)

### 7. Blockchain Anchor (`src/kgen/provenance/blockchain/anchor.js`)

**Primary Class**: `BlockchainAnchor` (lines 12-526)

**Integrity Functions**:
- `queueForAnchoring(recordId, hash, metadata)` (line 76) - Queue for blockchain
- `verifyAnchor(recordId, hash)` (line 109) - Verify blockchain integrity
- `getAnchorStatus(recordId)` (line 160) - Check anchoring status

**Merkle Tree Operations**:
- `_buildMerkleTree(records)` (line 404) - Merkle tree construction
- `_verifyMerkleInclusion(hash, proof, merkleRoot)` (line 490) - Inclusion proofs
- Blockchain transaction management (lines 460-488)

---

## 🧠 Graph Algorithms & Analysis

### Path Finding & Traversal Algorithms

**Lineage Traversal** (`src/kgen/provenance/tracker.js`):
- `_getUpstreamLineage(entityId, maxDepth)` (line 903) - Recursive upstream traversal
- `_getDownstreamLineage(entityId, maxDepth)` (line 910) - Recursive downstream traversal  
- `_buildLineageGraph(entityId, options)` (line 917) - Complete graph construction

**Query Optimization** (`src/kgen/query/engine.js`):
- `_optimizeJoinOrder(steps)` (line 754) - Join order optimization
- `_estimateQueryCost(steps)` (line 744) - Cost-based optimization
- `_identifyRequiredIndexes(patterns)` (line 759) - Index identification

### Pattern Detection & Analysis

**Semantic Patterns** (`src/kgen/semantic/processor.js`):
- `_identifySemanticPatterns(graph, templates)` (line 1261) - Multi-type pattern identification
- `_identifyPatternType(graph, patternType, templates)` (line 1797) - Specific pattern detection
- `_identifyHierarchicalPatterns(graph)` (line 1816) - Hierarchy detection
- `_identifyTemporalPatterns(graph)` (line 1826) - Temporal pattern analysis

**Graph Metrics** (`src/kgen/query/engine.js`):
- `_calculateBasicMetrics(graph)` (line 875) - Basic graph statistics
- `_calculateStructuralMetrics(graph)` (line 884) - Structural analysis
- `_calculateCentralityMetrics(graph)` (line 910) - Centrality measures
- `_calculateConnectivityMetrics(graph)` (line 919) - Connectivity analysis

---

## 🔧 Utility Functions & Helpers

### Graph Manipulation Utilities

**Entity Processing** (`src/kgen/semantic/processor.js`):
- `_extractSemanticEntities(graph)` (line 1168) - Entity extraction with types
- `_extractSemanticRelationships(graph)` (line 1225) - Relationship extraction
- `_calculateEntitySimilarities(entities)` (line 1602) - Similarity computation

**Data Conversion** (`src/kgen/rdf/index.js`):
- `termFromPattern(pattern)` (line 438) - Pattern to N3 term conversion
- `detectFormat(filePath)` (line 511) - RDF format detection
- `processRDFFile(filePath, format, options)` (line 488) - File processing

### Validation & Integrity

**Integrity Verification** (`src/kgen/provenance/tracker.js`):
- `verifyIntegrity(records)` (line 484) - Record integrity verification
- `verifyHashChain()` (line 1070) - Hash chain validation
- `_generateIntegrityHash(context)` (line 864) - Cryptographic hash generation

**Graph Validation** (`src/kgen/semantic/processor.js`):
- `validateGraph(graph, constraints, options)` (line 262) - Comprehensive validation
- `_checkBasicConsistency(graph)` (line 1874) - Basic consistency checks
- `_checkSemanticConsistency(graph)` (line 1933) - Semantic validation
- `_checkLogicalConsistency(graph)` (line 1973) - Logic validation

---

## 📊 Visualization & Export

### Graph Visualization Support

**Format Converters** (`src/kgen/provenance/tracker.js`):
- `_convertToD3Format(visualization)` (line 1494) - D3.js format conversion
- `_convertToGraphvizFormat(visualization)` (line 1506) - Graphviz DOT format
- `getVisualizationData(options)` (line 1215) - Multi-format visualization data

**Export Formats** (`src/kgen/provenance/tracker.js`):
- `_exportAsTurtle(options)` (line 977) - Turtle format export
- `_exportAsJsonLD(options)` (line 982) - JSON-LD format export
- `_exportAsRDFXML(options)` (line 987) - RDF/XML format export
- `_exportAsJSON(options)` (line 992) - JSON format export

---

## 🚀 Usage Examples

### Basic Graph Querying
```javascript
// Initialize query engine
const queryEngine = new QueryEngine(config);
await queryEngine.initialize();

// Execute SPARQL query with optimization
const results = await queryEngine.executeSPARQL(`
  PREFIX prov: <http://www.w3.org/ns/prov#>
  SELECT ?entity ?activity ?agent WHERE {
    ?entity prov:wasGeneratedBy ?activity .
    ?activity prov:wasAssociatedWith ?agent .
  }
`, { enableOptimization: true });
```

### Entity Lineage Tracking
```javascript
// Initialize provenance tracker
const tracker = new ProvenanceTracker(config);
await tracker.initialize();

// Track entity lineage
const lineage = await tracker.trackEntityLineage('entity-123', {
  sources: [{ id: 'source-1' }, { id: 'source-2' }],
  transformations: ['normalize', 'validate'],
  operationId: 'op-456'
});

// Get advanced lineage with analytics
const advancedLineage = await tracker.getAdvancedEntityLineage('entity-123', {
  includeUpstream: true,
  includeDownstream: true,
  maxDepth: 5,
  includeImpactAnalysis: true
});
```

### Semantic Processing
```javascript
// Initialize semantic processor
const processor = new SemanticProcessor(config);
await processor.initialize();

// Load and align ontologies
await processor.loadOntology({
  type: 'url',
  uri: 'https://example.com/ontology.ttl',
  format: 'turtle'
});

// Perform reasoning
const inferredGraph = await processor.performReasoning(graph, rules, {
  enableCaching: true,
  distributed: false
});
```

### Graph Visualization
```javascript
// Get visualization data
const vizData = await tracker.getVisualizationData({
  format: 'cytoscape' // or 'd3', 'graphviz'
});

// Convert to different formats
const d3Data = await tracker.getVisualizationData({ format: 'd3' });
const dotFormat = await tracker.getVisualizationData({ format: 'graphviz' });
```

---

## 📈 Performance Characteristics

### Query Performance
- **Indexing**: Automatic index creation and management (src/kgen/query/engine.js:566-577)
- **Caching**: Query result caching with TTL (src/kgen/query/engine.js:604-636)
- **Optimization**: Cost-based query optimization (src/kgen/query/engine.js:642-652)

### Storage Performance
- **Compression**: Automatic data compression (src/kgen/provenance/storage/index.js:98-100)
- **Encryption**: Optional encryption at rest (src/kgen/provenance/storage/index.js:93-95)
- **Batching**: Batch operations for blockchain anchoring (src/kgen/provenance/blockchain/anchor.js:92-94)

### Scalability Features
- **Multi-backend**: Supports file, database, and object storage
- **Distributed**: Blockchain anchoring for tamper-evidence
- **Streaming**: Real-time analytics and metrics collection

---

## 🔗 Integration Points

### External Dependencies
- **N3.js**: RDF processing and SPARQL parsing
- **SparqlJS**: Query parsing and optimization  
- **Crypto**: Hash generation and digital signatures
- **EventEmitter**: Reactive event-driven architecture

### Configuration Options
- Storage backends: `memory`, `file`, `database`
- Blockchain networks: `ethereum`, `bitcoin`, `hyperledger`
- Compliance modes: `GDPR`, `SOX`, `HIPAA`
- Export formats: `turtle`, `json-ld`, `rdf-xml`, `json`

---

## 📝 Summary

The KGEN project provides a comprehensive knowledge graph utility ecosystem with:

- **15+ graph algorithms** for traversal, analysis, and optimization
- **3 specialized query engines** with SPARQL support and optimization
- **Multi-format** RDF processing with validation and reasoning
- **Blockchain-anchored** provenance tracking for integrity
- **Advanced lineage** tracking with impact analysis
- **Visualization support** for multiple graph formats
- **Enterprise-grade** compliance and security features

All utilities are well-documented with file references and provide production-ready implementations for knowledge graph operations in enterprise environments.