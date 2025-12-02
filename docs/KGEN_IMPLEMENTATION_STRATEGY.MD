# KGEN Implementation Strategy

## Architecture Overview

KGEN follows a **single entrypoint architecture** with no index.* files, utilizing ES modules and lazy loading for optimal performance.

## Single Entrypoint Policy

### Core Principle
- **One Binary**: `bin/kgen.mjs` - Single executable entry point
- **No Index Files**: All index.js/index.ts files have been removed from the codebase
- **Direct Imports**: All modules import specific implementation files directly
- **Lazy Loading**: Advanced features loaded on-demand for cold start performance

### File Structure
```
kgen/
├── bin/kgen.mjs                    # Single CLI entrypoint
├── src/kgen/
│   ├── deterministic/              # Core deterministic rendering
│   │   ├── index.js               # Main deterministic system
│   │   ├── artifact-generator.js  # Artifact generation engine
│   │   └── core-renderer.js       # Template rendering
│   ├── drift/
│   │   └── detector.js            # Drift detection logic
│   ├── impact/
│   │   └── calculator.js          # Impact analysis
│   ├── rdf/
│   │   └── standalone-bridge.js   # RDF processing bridge
│   └── validation/
│       └── cli-integration.js     # Validation engine
└── kgen.config.js                 # Configuration file
```

### Import Patterns

**✅ Correct:**
```javascript
// Direct imports to specific implementations
import { DeterministicArtifactGenerator } from '../src/kgen/deterministic/artifact-generator.js';
import { DriftDetector } from '../src/kgen/drift/detector.js';
import { StandaloneKGenBridge } from '../src/kgen/rdf/standalone-bridge.js';
```

**❌ Removed:**
```javascript
// No longer used - all index files removed
import { SomeModule } from '../src/kgen/module/index.js';
import * as Utils from '../src/utils/index.js';
```

## Provenance Schema Specification

### Attestation Data Structure

Each generated artifact includes cryptographic attestation following this schema:

```typescript
interface AttestationSchema {
  artifact: {
    path: string;           // Relative path to generated artifact
    contentHash: string;    // SHA-256 of artifact content
    size: number;          // File size in bytes  
    mimeType: string;      // MIME type detection
  };
  
  generation: {
    template: string;       // Template name used
    templatePath: string;   // Full path to template file
    templateHash: string;   // SHA-256 of template content
    context: object;        // Generation context data
    contextHash: string;    // SHA-256 of serialized context
    graphFile?: string;     // RDF graph file used (if any)
    graphHash?: string;     // SHA-256 of graph content
  };
  
  environment: {
    generatedAt: string;    // ISO timestamp (deterministic)
    kgenVersion: string;    // KGEN version used
    nodeVersion: string;    // Node.js version
    platform: string;      // OS platform  
    arch: string;          // CPU architecture
    staticBuildTime: string; // Static timestamp for determinism
  };
  
  verification: {
    reproducible: boolean;  // Whether artifact can be reproduced
    deterministic: boolean; // Whether generation is deterministic
    verified: boolean;      // Verification status
    verificationCount: number; // Number of verification attempts
  };
  
  provenance: {
    generator: string;      // "kgen-cli"
    method: string;         // Generation method used
    inputs: Input[];        // All input sources
  };
  
  signatures?: {
    contentSignature: string;      // Cryptographic signature of content
    attestationSignature: string;  // Signature of attestation data
    algorithm: string;             // Signing algorithm (e.g., "ed25519")
  };
}

interface Input {
  type: 'template' | 'graph' | 'context' | 'config';
  path: string;
  hash: string;
}
```

### Deterministic Timestamps

All timestamps use deterministic generation:

```javascript
// Static build time for reproducible builds
const staticBuildTime = '2024-01-01T00:00:00.000Z';

// Deterministic timestamp function
function getDeterministicISOString() {
  return staticBuildTime;
}
```

## Content Addressing System (CAS)

### Hash Generation Strategy

1. **Content Hash**: SHA-256 of final artifact content
2. **Template Hash**: SHA-256 of template source
3. **Context Hash**: SHA-256 of JSON.stringify(context, Object.keys(context).sort())
4. **Composite Hash**: SHA-256 of concatenated hashes

### CAS Implementation

```javascript
class ContentAddressedStorage {
  // Generate content-addressed identifier
  generateCASIdentifier(content, template, context) {
    const contentHash = sha256(content);
    const templateHash = sha256(template);
    const contextHash = sha256(JSON.stringify(context, Object.keys(context).sort()));
    const composite = sha256(contentHash + templateHash + contextHash);
    
    return {
      contentHash: `sha256:${contentHash}`,
      templateHash: `sha256:${templateHash}`,
      contextHash: `sha256:${contextHash}`,
      compositeHash: `sha256:${composite}`
    };
  }
  
  // Store artifact with CAS addressing
  async store(artifact, metadata) {
    const casId = this.generateCASIdentifier(
      artifact.content,
      artifact.template,
      artifact.context
    );
    
    // Store with content-addressed path
    const casPath = `cas/${casId.compositeHash.slice(7, 19)}/${artifact.name}`;
    await this.writeFile(casPath, artifact.content);
    
    // Generate attestation
    const attestation = this.generateAttestation(artifact, casId, metadata);
    await this.writeFile(`${casPath}.attest.json`, JSON.stringify(attestation, null, 2));
    
    return { casPath, casId, attestation };
  }
}
```

## Template Package Contract

### Template Structure Requirements

Templates must conform to this contract:

```yaml
---
# Required frontmatter properties
to: "{{ outputPath }}/{{ name }}.{{ extension }}"    # Output file path
inject: false                                        # Whether to inject into existing file
skipIf: "{{ skipCondition }}"                       # Conditional generation
chmod: "755"                                        # File permissions
sh: "npm install {{ dependencies }}"                # Post-generation command

# Optional metadata
description: "Template description"
author: "Template author" 
version: "1.0.0"
tags: ["api", "service"]

# Schema validation
schema:
  properties:
    name:
      type: string
      required: true
    extension:
      type: string
      default: "js"
---
Template content with {{ variables }}
```

### Frontmatter Processing Pipeline

1. **Parse**: Extract YAML frontmatter using gray-matter
2. **Validate**: Check required properties and schema
3. **Resolve**: Process template variables in frontmatter
4. **Execute**: Apply generation rules (inject, skipIf, etc.)

```javascript
async function processFrontmatter(templateContent, context) {
  const { data: frontmatter, content: template } = matter(templateContent);
  
  // Validate required properties
  if (!frontmatter.to) {
    throw new Error('Template missing required "to" property');
  }
  
  // Resolve template variables in frontmatter
  const resolvedFrontmatter = await resolveTemplateVars(frontmatter, context);
  
  // Process generation rules
  if (resolvedFrontmatter.skipIf && evaluateCondition(resolvedFrontmatter.skipIf)) {
    return { skipped: true, reason: 'skipIf condition met' };
  }
  
  return { frontmatter: resolvedFrontmatter, template, skipped: false };
}
```

## Rules Package Contract

### N3 Rules Format

Rules files must follow this structure:

```n3
@prefix ex: <http://example.org/> .
@prefix kgen: <https://kgen.io/ontology#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

# Rule metadata
{
  ?rule a kgen:Rule ;
        kgen:name "validation-rule" ;
        kgen:description "Validates API compliance" ;
        kgen:version "1.0.0" .
} => {
  ?rule kgen:status kgen:Active .
} .

# Business logic rules
{
  ?api a ex:API ;
       ex:hasEndpoint ?endpoint .
  ?endpoint ex:method "POST" ;
           ex:hasAuthentication false .
} => {
  ?endpoint ex:securityViolation "POST endpoints must have authentication" .
} .
```

### Rule Processing Engine

```javascript
class RuleEngine {
  async loadRules(rulesDir) {
    const ruleFiles = await this.discoverRuleFiles(rulesDir);
    const rules = [];
    
    for (const file of ruleFiles) {
      const content = await fs.readFile(file, 'utf8');
      const parsed = await this.parseN3Rules(content);
      rules.push({
        file,
        name: this.extractRuleName(parsed),
        rules: parsed,
        metadata: this.extractMetadata(parsed)
      });
    }
    
    return rules;
  }
  
  async executeRules(graph, rules) {
    const reasoner = new N3.Reasoner(rules);
    const inferred = reasoner.reason(graph);
    
    return {
      originalTriples: graph.size,
      inferredTriples: inferred.size,
      newTriples: inferred.size - graph.size,
      violations: this.extractViolations(inferred)
    };
  }
}
```

## Performance Architecture

### Cold Start Optimization

Target: ≤2 seconds cold start time

```javascript
// Lazy loading strategy
class LazyLoader {
  async loadModule(modulePath) {
    if (!this.moduleCache.has(modulePath)) {
      const module = await import(modulePath);
      this.moduleCache.set(modulePath, module);
    }
    return this.moduleCache.get(modulePath);
  }
}

// Main CLI optimization
const coldStartTime = performance.now();

// Only load core modules initially
const main = defineCommand({
  async run({ args }) {
    // Load advanced modules only when needed
    if (args.command === 'advanced') {
      const { AdvancedModule } = await import('./advanced/index.js');
      return new AdvancedModule().run(args);
    }
  }
});
```

### Memory Management

```javascript
class MemoryOptimizer {
  constructor() {
    this.cacheSize = parseInt(process.env.KGEN_CACHE_SIZE) || 100;
    this.cache = new LRUCache({ max: this.cacheSize });
  }
  
  // Garbage collection hints
  forceGC() {
    if (global.gc) {
      global.gc();
    }
  }
  
  // Memory monitoring
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    };
  }
}
```

## Error Handling Strategy

### Structured Error Response

All operations return structured JSON responses:

```javascript
class StandardizedOutput {
  success(operation, result) {
    return {
      success: true,
      operation,
      result,
      metadata: {
        timestamp: getDeterministicISOString(),
        version: '1.0.0'
      }
    };
  }
  
  error(operation, code, message, details) {
    return {
      success: false,
      operation,
      error: {
        code,
        message,
        details
      },
      metadata: {
        timestamp: getDeterministicISOString(),
        version: '1.0.0'
      }
    };
  }
}
```

### Exit Code Strategy

- **0**: Success
- **1**: General error (invalid input, runtime failure)
- **3**: Drift detected (semantic drift in artifacts)

## Security Considerations

### Input Validation

```javascript
class SecurityValidator {
  validateTemplate(templateContent) {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /process\.exit/,
      /require\s*\(/
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(templateContent)) {
        throw new Error(`Dangerous pattern detected: ${pattern}`);
      }
    }
  }
  
  validateRDF(rdfContent) {
    // Prevent XXE attacks in RDF/XML
    if (rdfContent.includes('<!ENTITY')) {
      throw new Error('External entities not allowed in RDF');
    }
  }
}
```

### Sandboxing

```javascript
import vm from 'vm2';

class SafeTemplateRenderer {
  render(template, context) {
    const vm = new VM({
      timeout: 5000,
      sandbox: {
        ...context,
        // Safe built-ins only
        Math,
        Date: () => new Date(getDeterministicISOString())
      }
    });
    
    return vm.run(template);
  }
}
```

## Testing Strategy

### Unit Testing

- **Framework**: Node.js built-in test runner
- **Coverage**: >90% line coverage
- **Focus**: Individual function validation

### Integration Testing

- **Framework**: Cucumber.js for BDD
- **Scenarios**: End-to-end CLI workflows  
- **Performance**: Cold start and rendering benchmarks

### Reproducibility Testing

```javascript
describe('Reproducibility', () => {
  it('generates identical artifacts across runs', async () => {
    const runs = [];
    
    for (let i = 0; i < 5; i++) {
      const result = await kgen.generate('template.njk', context);
      runs.push(result.contentHash);
    }
    
    // All hashes should be identical
    expect(new Set(runs).size).toBe(1);
  });
});
```

---

**Implementation Status**: Complete  
**Architecture Version**: 1.0.0  
**Last Updated**: September 12, 2025