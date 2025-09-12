# KGEN v1 Processing Pipeline Architecture

## Pipeline Overview

KGEN v1 implements a seven-stage processing pipeline that transforms RDF knowledge graphs into deterministic, provenance-tracked artifacts:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1. Graph       │───▶│  2. Schema      │───▶│  3. Context     │
│  Ingestion      │    │  Validation     │    │  Enrichment     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  4. Template    │───▶│  5. Deterministic│───▶│  6. Attestation │
│  Resolution     │    │  Rendering      │    │  Creation       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                      ┌─────────────────┐    ┌─────────────────┐
                      │  7. Git         │    │  Output         │
                      │  Integration    │    │  Artifacts      │
                      └─────────────────┘    └─────────────────┘
```

## Stage 1: Graph Ingestion

### Input Processing
```javascript
class GraphIngestionEngine {
  async ingestGraph(graphPath, format = 'auto') {
    // Auto-detect format
    const detectedFormat = format === 'auto' 
      ? this.detectFormat(graphPath)
      : format;
    
    // Parse with appropriate parser
    const parser = this.getParser(detectedFormat);
    const rawTriples = await parser.parse(fs.readFileSync(graphPath, 'utf8'));
    
    // Build internal graph representation
    const graph = await this.buildGraph(rawTriples);
    
    // Extract metadata
    const metadata = await this.extractMetadata(graph);
    
    return {
      graph,
      metadata,
      format: detectedFormat,
      tripleCount: rawTriples.length,
      contentHash: this.hashContent(graphPath)
    };
  }
}
```

### Supported Formats
- **Turtle (.ttl)**: Primary format for knowledge graphs
- **JSON-LD (.jsonld)**: Web-friendly semantic data
- **N-Triples (.nt)**: Simple triple format
- **N3 (.n3)**: Extended format with reasoning rules
- **RDF/XML (.rdf)**: Legacy XML serialization

### Processing Steps
```
Input File ──► Format Detection ──► Parser Selection ──► Triple Extraction
     │               │                    │                    │
     ▼               ▼                    ▼                    ▼
Encoding Check   Extension Map      N3.js/RDF-Ext      Internal Graph
     │               │                    │                    │
     ▼               ▼                    ▼                    ▼
UTF-8 Validation  MIME Type Check    Error Handling     Metadata Extract
```

## Stage 2: Schema Validation

### SHACL Constraint Application
```javascript
class SchemaValidationEngine {
  async validateGraph(graph, shapesPath) {
    // Load SHACL shapes
    const shapes = await this.loadShapes(shapesPath);
    
    // Initialize validator
    const validator = new SHACLValidator(shapes);
    
    // Execute validation
    const report = await validator.validate(graph);
    
    // Process results
    return {
      conforms: report.conforms,
      violations: report.results.map(this.formatViolation),
      summary: this.generateSummary(report),
      timestamp: new Date().toISOString()
    };
  }
  
  formatViolation(result) {
    return {
      severity: result.severity.value,
      focusNode: result.focusNode?.value,
      property: result.path?.value,
      message: result.message[0]?.value,
      constraint: result.constraint?.value
    };
  }
}
```

### Validation Categories
```
Knowledge Graph Validation:
├── Structural Constraints
│   ├── Required properties
│   ├── Data type validation
│   ├── Cardinality constraints
│   └── Value range restrictions
├── Semantic Constraints  
│   ├── Domain/range consistency
│   ├── Ontology compliance
│   ├── Relationship validity
│   └── Classification rules
└── Policy Constraints
    ├── Governance requirements
    ├── Security standards
    ├── Quality metrics
    └── Compliance rules
```

### Error Handling
```javascript
// Graceful degradation on validation errors
if (!validationResult.conforms) {
  const criticalViolations = validationResult.violations
    .filter(v => v.severity === 'Violation');
    
  if (criticalViolations.length > 0) {
    throw new ValidationError('Critical violations detected', {
      violations: criticalViolations,
      suggestions: this.generateSuggestions(criticalViolations)
    });
  }
  
  // Continue with warnings
  console.warn(`${warnings.length} validation warnings detected`);
}
```

## Stage 3: Context Enrichment

### Reasoning Rule Execution
```javascript
class ContextEnrichmentEngine {
  async enrichContext(graph, rulesPath) {
    // Load N3 reasoning rules
    const rules = await this.loadReasoningRules(rulesPath);
    
    // Execute reasoning
    const reasoner = new N3.Reasoner(rules);
    const enrichedGraph = reasoner.reason(graph);
    
    // Extract template context
    const context = await this.extractContext(enrichedGraph);
    
    // Add environment variables
    context.environment = this.captureEnvironment();
    
    return {
      originalTripleCount: graph.size,
      enrichedTripleCount: enrichedGraph.size,
      derivedTriples: enrichedGraph.size - graph.size,
      context,
      reasoningRules: rules.length
    };
  }
}
```

### Context Building Process
```
Base Graph ──► Rule Loading ──► Reasoning Engine ──► Derived Facts
    │              │                   │                  │
    ▼              ▼                   ▼                  ▼
SPARQL Query   N3 Rules Parse    Forward Chaining   Context Object
    │              │                   │                  │
    ▼              ▼                   ▼                  ▼
Data Extract   Rule Validation   Conflict Resolution  Variable Binding
```

### Context Structure
```javascript
// Enriched context object
const context = {
  // Domain data from knowledge graph
  entities: [...],
  relationships: [...],
  properties: [...],
  
  // Derived information from reasoning
  classifications: [...],
  constraints: [...],
  recommendations: [...],
  
  // Template-specific variables
  templateVars: {
    serviceName: 'user-service',
    endpoints: [...],
    schemas: [...],
    validationRules: [...]
  },
  
  // Environment context
  environment: {
    kgenVersion: '1.0.0',
    nodeVersion: 'v20.0.0',
    buildTime: '2024-01-01T00:00:00.000Z',
    platform: 'linux-x64'
  },
  
  // Provenance tracking
  provenance: {
    graphHash: 'sha256:abc123...',
    rulesHash: 'sha256:def456...',
    contextHash: 'sha256:ghi789...'
  }
};
```

## Stage 4: Template Resolution

### Template Selection Logic
```javascript
class TemplateResolver {
  async resolveTemplate(context, templateHint) {
    // Check explicit template specification
    if (templateHint) {
      return await this.loadTemplate(templateHint);
    }
    
    // Graph-based template selection
    const candidates = await this.findCandidateTemplates(context);
    
    // Score templates based on context match
    const scored = candidates.map(template => ({
      template,
      score: this.calculateMatchScore(template, context)
    }));
    
    // Select highest scoring template
    const best = scored.sort((a, b) => b.score - a.score)[0];
    
    if (best.score < this.MINIMUM_MATCH_THRESHOLD) {
      throw new Error('No suitable template found for context');
    }
    
    return best.template;
  }
  
  calculateMatchScore(template, context) {
    // Variable requirement satisfaction
    const varScore = this.scoreVariableMatch(template.variables, context);
    
    // Domain pattern matching  
    const domainScore = this.scoreDomainMatch(template.domain, context);
    
    // Quality metrics
    const qualityScore = this.scoreTemplateQuality(template);
    
    return (varScore * 0.5) + (domainScore * 0.3) + (qualityScore * 0.2);
  }
}
```

### Template Analysis
```javascript
// Template metadata extraction
const templateAnalysis = {
  name: 'rest-api',
  path: '_templates/rest-api.njk',
  variables: ['serviceName', 'endpoints', 'schemas'],
  requiredContext: ['entities', 'relationships'],
  domainPatterns: ['api', 'service', 'rest'],
  complexity: 'medium',
  deterministic: true,
  version: '1.2.0'
};
```

## Stage 5: Deterministic Rendering

### Rendering Engine
```javascript
class DeterministicRenderingEngine {
  constructor(options = {}) {
    this.staticBuildTime = options.staticBuildTime || '2024-01-01T00:00:00.000Z';
    this.enableCaching = options.enableCaching !== false;
    this.strictMode = options.strictMode !== false;
  }
  
  async render(templatePath, context) {
    // Prepare deterministic environment
    const deterministicEnv = this.prepareDeterministicEnvironment();
    
    // Configure Nunjucks with strict settings
    const nunjucks = this.configureNunjucks({
      trimBlocks: true,
      lstripBlocks: true,
      throwOnUndefined: this.strictMode
    });
    
    // Override time functions for determinism
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor(...args) {
        if (args.length === 0) {
          return new originalDate(this.staticBuildTime);
        }
        return new originalDate(...args);
      }
    };
    
    try {
      // Render template
      const content = nunjucks.render(templatePath, context);
      
      // Apply canonical formatting
      const canonicalContent = this.canonicalizeContent(content);
      
      // Generate content hash
      const contentHash = crypto
        .createHash('sha256')
        .update(canonicalContent)
        .digest('hex');
      
      return {
        content: canonicalContent,
        contentHash,
        metadata: {
          template: templatePath,
          contextHash: this.hashObject(context),
          buildTime: this.staticBuildTime,
          deterministic: true
        }
      };
      
    } finally {
      // Restore original Date
      global.Date = originalDate;
    }
  }
}
```

### Deterministic Guarantees
```
Rendering Constraints:
├── Static Build Time (2024-01-01T00:00:00.000Z)
├── Canonical Serialization (consistent formatting)
├── Deterministic Math.random() seeding  
├── Stable Object.keys() ordering
├── Unicode normalization (NFC)
└── Whitespace normalization
```

## Stage 6: Attestation Creation

### Provenance Collection
```javascript
class AttestationEngine {
  async createAttestation(artifact, generation) {
    const attestation = {
      '@context': [
        'https://www.w3.org/ns/prov',
        'https://kgen.dev/contexts/v1'
      ],
      '@type': 'kgen:GenerationAttestation',
      
      // Artifact information
      artifact: {
        path: artifact.path,
        contentHash: artifact.contentHash,
        size: artifact.content.length,
        mimeType: this.detectMimeType(artifact.path)
      },
      
      // Generation provenance
      generation: {
        template: {
          path: generation.templatePath,
          contentHash: generation.templateHash,
          variables: generation.variables
        },
        context: {
          graphHash: generation.contextHash,
          rulesApplied: generation.rules.length,
          enrichedTriples: generation.derivedTriples
        },
        environment: generation.environment
      },
      
      // SLSA compliance
      slsa: this.generateSLSAProvenance(generation),
      
      // Digital signature
      signature: await this.signAttestation(attestation)
    };
    
    return attestation;
  }
}
```

### SLSA Integration
```javascript
// SLSA Build Type specification
const slsaProvenance = {
  buildType: 'https://kgen.dev/build-types/deterministic-v1',
  builder: {
    id: 'https://kgen.dev/builders/kgen-v1'
  },
  invocation: {
    configSource: {
      uri: 'git+https://github.com/org/repo@refs/heads/main',
      digest: { sha1: generation.gitCommit }
    }
  },
  materials: [
    {
      uri: generation.templatePath,
      digest: { sha256: generation.templateHash }
    },
    {
      uri: generation.graphPath,  
      digest: { sha256: generation.graphHash }
    }
  ]
};
```

## Stage 7: Git Integration

### Storage Operations
```javascript
class GitStorageEngine {
  async storeArtifact(artifact, attestation) {
    // Store artifact content as Git blob
    const artifactHash = await this.git.writeBlob(artifact.content);
    
    // Store attestation as Git blob
    const attestationData = JSON.stringify(attestation, null, 2);
    const attestationHash = await this.git.writeBlob(attestationData);
    
    // Link attestation to artifact via git-notes
    await this.git.addNote(
      artifactHash, 
      attestationData, 
      'kgen-attestations'
    );
    
    // Create KGEN references
    await this.git.updateRef(
      `refs/kgen/artifacts/${artifact.template}/${artifact.name}`,
      artifactHash
    );
    
    await this.git.updateRef(
      `refs/kgen/attestations/${artifactHash}`,
      attestationHash
    );
    
    return {
      artifactHash,
      attestationHash,
      storedAt: new Date().toISOString()
    };
  }
}
```

### Reference Management
```
Git Reference Structure:
├── refs/kgen/artifacts/<template>/<name> → artifact blob
├── refs/kgen/attestations/<hash> → attestation blob
├── refs/kgen/templates/<name> → template blob
├── refs/kgen/baselines/<path> → drift baseline
└── refs/kgen/metadata/generation → generation metadata
```

## Pipeline Performance

### Optimization Strategies
```javascript
// Stage-level caching
class PipelineCache {
  async getCachedResult(stage, inputHash) {
    const cacheKey = `${stage}:${inputHash}`;
    return await this.cache.get(cacheKey);
  }
  
  async setCachedResult(stage, inputHash, result) {
    const cacheKey = `${stage}:${inputHash}`;
    const ttl = this.getTTL(stage);
    return await this.cache.set(cacheKey, result, ttl);
  }
}

// Parallel processing where possible
async function processMultipleArtifacts(artifacts) {
  const results = await Promise.all(
    artifacts.map(async (artifact) => {
      const pipeline = new ProcessingPipeline();
      return await pipeline.execute(artifact);
    })
  );
  
  return results;
}
```

### Performance Metrics
```
Pipeline Stage Performance Targets:
├── Graph Ingestion: ≤ 50ms for typical graphs
├── Schema Validation: ≤ 100ms for standard shapes
├── Context Enrichment: ≤ 200ms for reasoning rules
├── Template Resolution: ≤ 20ms with cache hits
├── Deterministic Rendering: ≤ 150ms p95
├── Attestation Creation: ≤ 30ms for signing
└── Git Integration: ≤ 40ms for storage operations
```

## Error Handling & Recovery

### Pipeline Resilience
```javascript
class PipelineExecutor {
  async executePipeline(input) {
    const results = {};
    
    try {
      // Stage 1: Graph Ingestion
      results.ingestion = await this.executeStage('ingestion', input);
      
      // Stage 2: Schema Validation
      results.validation = await this.executeStage('validation', results.ingestion);
      
      // Continue through all stages...
      
    } catch (error) {
      // Capture partial results for debugging
      error.pipelineResults = results;
      error.failedStage = this.currentStage;
      
      // Attempt recovery if possible
      if (this.canRecover(error)) {
        return await this.recoverFromError(error, results);
      }
      
      throw error;
    }
  }
}
```

This processing pipeline architecture ensures deterministic, traceable, and performant artifact generation while maintaining strict semantic validation and provenance tracking throughout the entire process.