# KGEN v1 System Architecture Overview

## Architecture Principles

KGEN v1 implements a **Declarative, Deterministic, Layered Logic for Semantic Software (DfLLSS)** architecture based on four fundamental layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 4: Git Storage                    │
│  Content-Addressed Blobs • Provenance Tracking • Dist.    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                Layer 3: Template Rendering                 │
│    Nunjucks Templates • Deterministic Generation • Cache   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                Layer 2: SHACL Validation                   │
│   Constraint Enforcement • Policy Gates • Compliance      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│               Layer 1: RDF Knowledge Graphs                │
│   Semantic Data Model • Reasoning Rules • SPARQL Queries  │
└─────────────────────────────────────────────────────────────┘
```

## System Components

### Core Processing Engine
```
┌─────────────────────────────────────────────────────────────┐
│                    KGEN CLI Engine                         │
├─────────────────────────────────────────────────────────────┤
│ • Configuration Management (c12)                           │
│ • Command Dispatch (Citty)                                 │
│ • Performance Monitoring                                   │
│ • Error Handling & Logging                                 │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Graph Engine   │ │ Template Engine  │ │  Storage Engine  │
│                  │ │                  │ │                  │
│ • RDF Processing │ │ • Nunjucks       │ │ • Git Operations │
│ • N3 Reasoning   │ │ • Context Build  │ │ • Content Hash   │
│ • SPARQL Query   │ │ • Deterministic  │ │ • Provenance     │
│ • Semantic Enrich│ │ • Caching        │ │ • Attestations   │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### Data Flow Architecture
```
Knowledge Graphs ──┐
                   │
Templates ─────────┼──► Context Builder ──► Nunjucks Renderer
                   │         │                      │
SHACL Rules ───────┘         │                      │
                             ▼                      ▼
                     Validation Engine     Deterministic Output
                             │                      │
                             ▼                      ▼
                     Policy Enforcement    Content Addressing
                             │                      │
                             ▼                      ▼
                        Compliance Gate      Git Blob Storage
                                                    │
                                                    ▼
                                            Cryptographic
                                            Attestation
```

## Directory Structure

```
unjucks/                          # Project root
├── bin/kgen.mjs                  # CLI entry point
├── src/                          # Core implementation
│   ├── kgen/                     # KGEN engine modules
│   │   ├── cli/                  # Command-line interface
│   │   ├── deterministic/        # Deterministic rendering system
│   │   ├── drift/                # Drift detection engine
│   │   ├── git/                  # Git integration layer
│   │   ├── impact/               # Impact analysis calculator
│   │   ├── rdf/                  # RDF processing and reasoning
│   │   └── validation/           # SHACL validation framework
│   ├── observability/            # OpenTelemetry tracing
│   ├── performance/              # Performance testing & optimization
│   └── utils/                    # Shared utilities
├── docs/                         # Documentation
│   ├── adr/                      # Architecture Decision Records
│   ├── architecture/             # Architecture documentation
│   └── api/                      # API documentation
├── knowledge/                    # RDF knowledge graphs
├── rules/                        # SHACL shapes and N3 rules
├── _templates/                   # Nunjucks template library
├── generated/                    # Generated artifacts output
├── .kgen/                        # KGEN state and cache
│   ├── state/                    # Drift detection baselines
│   └── cache/                    # Template compilation cache
└── .git/                         # Git repository
    ├── objects/                  # Content-addressed artifact storage
    └── notes/                    # Cryptographic attestations
```

## Processing Pipelines

### Artifact Generation Pipeline
```
1. Graph Ingestion
   ├── Parse RDF knowledge graphs (Turtle, JSON-LD, N-Triples)
   ├── Load reasoning rules (N3, SHACL)
   └── Execute SPARQL queries for context extraction

2. Schema Validation
   ├── Apply SHACL constraints to knowledge graphs
   ├── Validate template context requirements
   └── Enforce policy compliance rules

3. Context Enrichment
   ├── Execute N3 reasoning rules
   ├── Derive implicit relationships
   └── Build template context object

4. Template Resolution
   ├── Select appropriate templates based on graph patterns
   ├── Load template metadata and requirements
   └── Verify template deterministic properties

5. Deterministic Rendering
   ├── Render templates with static build time
   ├── Apply canonical serialization
   └── Generate content hash

6. Attestation Creation
   ├── Collect provenance metadata
   ├── Generate cryptographic signature
   └── Create SLSA-compliant attestation

7. Git Integration
   ├── Store artifacts as content-addressed blobs
   ├── Link attestations via git-notes
   └── Update KGEN references
```

### Validation Pipeline
```
Input Artifact/Graph
        │
        ▼
SHACL Shape Loading ──► Shape Compilation ──► Constraint Validation
        │                      │                      │
        ▼                      ▼                      ▼
Policy Rule Loading    Performance Cache      Violation Detection
        │                      │                      │
        ▼                      ▼                      ▼
Custom Function Exec   Result Caching        Error Report Gen
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                              ▼
                       Validation Report
                      (Conforms/Violations)
```

### Drift Detection Pipeline
```
Current State Scan ──► Baseline Comparison ──► Change Analysis
        │                      │                     │
        ▼                      ▼                     ▼
Artifact Hashing       Hash Comparison       Impact Calculation
        │                      │                     │
        ▼                      ▼                     ▼
Metadata Collection    Drift Classification   Risk Assessment
        │                      │                     │
        └──────────────────────┼─────────────────────┘
                              ▼
                        Drift Report
                    (Detection/Recommendations)
```

## Component Interactions

### CLI to Engine Communication
```javascript
// Command dispatch pattern
const command = defineCommand({
  meta: { name: 'generate', description: 'Generate artifacts' },
  args: { template: 'string', graph: 'string' },
  async run({ args }) {
    await kgen.initialize();
    return await kgen.artifactGenerate(args.graph, args.template);
  }
});
```

### Engine to RDF Bridge
```javascript
// Semantic processing integration
class KGenCLIEngine {
  async graphHash(filePath) {
    if (this.semanticProcessingEnabled) {
      return await this.rdfBridge.graphHash(filePath);
    } else {
      return this._fallbackGraphHash(filePath);
    }
  }
}
```

### Template to Context Binding
```javascript
// Context enrichment flow  
const context = {
  graph: await this.loadKnowledgeGraph(graphFile),
  template: await this.analyzeTemplate(templatePath),
  rules: await this.loadReasoningRules(),
  environment: await this.captureEnvironment()
};
```

## Performance Architecture

### Caching Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                    Performance Layer                       │
├─────────────────────────────────────────────────────────────┤
│ Template Cache     │ RDF Parse Cache    │ Validation Cache │
│ • Compiled temps   │ • Graph ASTs       │ • SHACL results  │
│ • Variable extract │ • Index structures │ • Policy checks  │
│ • Metadata cache   │ • Query results    │ • Error patterns │
└─────────────────────────────────────────────────────────────┘
```

### Lazy Loading Pattern
```javascript
// Optimized module loading
let DeterministicArtifactGenerator = null;
const lazyImport = async (modulePath) => {
  try {
    return await import(modulePath);
  } catch (error) {
    console.warn(`Could not load module ${modulePath}`);
    return null;
  }
};
```

### Benchmark Integration
```
Performance Targets:
├── Cold Start: ≤ 2s
├── Template Render: ≤ 150ms p95  
├── Cache Hit Rate: ≥ 80%
└── Memory Usage: ≤ 512MB
```

## Security Architecture

### Cryptographic Components
```
┌─────────────────────────────────────────────────────────────┐
│                   Security Layer                           │
├─────────────────────────────────────────────────────────────┤
│ Content Hashing    │ Digital Signing    │ Integrity Check  │
│ • SHA-256 primary  │ • Ed25519 sigs     │ • Hash verify    │
│ • Multihash future │ • Key rotation     │ • Sig validation │
│ • Merkle trees     │ • Multi-signature  │ • Tamper detect  │
└─────────────────────────────────────────────────────────────┘
```

### Provenance Tracking
```
Generation Event ──► Provenance Collection ──► Attestation Signing
       │                      │                       │
       ▼                      ▼                       ▼
Environment Capture    Metadata Aggregation    Signature Generation
       │                      │                       │
       ▼                      ▼                       ▼
Context Hashing       PROV Ontology Format     SLSA Compliance
       │                      │                       │
       └──────────────────────┼───────────────────────┘
                             ▼
                      Git Notes Storage
```

## Integration Points

### Git Storage Layer
```
.git/objects/<hash>           # Artifact content as blobs
.git/notes/kgen-attestations  # Provenance attestations  
.git/refs/kgen/artifacts/     # KGEN artifact references
.git/refs/kgen/templates/     # Template references
.git/refs/kgen/baselines/     # Drift detection baselines
```

### External Tool Integration
```
GitHub Actions ──► KGEN Generate ──► SLSA Provenance ──► Artifact Upload
      │                   │                │                    │
      ▼                   ▼                ▼                    ▼
CI/CD Pipeline      Template Render   Attestation Sign   Registry Store
```

## Observability

### OpenTelemetry Integration
```javascript
// Tracing instrumentation
const tracer = await initializeTracing({
  serviceName: 'kgen-cli',
  serviceVersion: '1.0.0', 
  enableJSONLExport: true,
  performanceTarget: 5 // 5ms p95 target
});
```

### Performance Monitoring
```
Metrics Collection:
├── Cold start time measurement
├── Template rendering duration
├── Cache hit/miss ratios  
├── Memory usage tracking
├── Error rate monitoring
└── Throughput measurement
```

This architecture provides the foundation for KGEN v1's deterministic, semantic, and git-first approach to artifact generation while maintaining high performance and comprehensive provenance tracking.