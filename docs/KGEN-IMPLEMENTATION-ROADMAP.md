# KGEN Implementation Roadmap
**Critical Priority Matrix for PRD Compliance**

## 🎯 Implementation Priority Matrix

### 🔴 CRITICAL PRIORITY (Week 1-2)
**These commands are essential for basic KGEN functionality and must be implemented first**

| Command | Business Impact | Technical Complexity | Dependencies |
|---------|----------------|---------------------|--------------|
| `kgen artifact generate` | **CRITICAL** - Core functionality, deterministic compilation | HIGH | Template engine integration |
| `kgen artifact drift` | **CRITICAL** - CI/CD pipeline compliance | MEDIUM | Provenance system |
| `kgen project attest` | **CRITICAL** - Enterprise audit requirements | LOW | Existing compliance logger |

**Estimated Effort:** 2 weeks
**Success Criteria:** Basic knowledge-to-artifact compilation pipeline functional

---

### 🟠 HIGH PRIORITY (Week 3)
**Essential for production deployment and operational requirements**

| Command | Business Impact | Technical Complexity | Dependencies |
|---------|----------------|---------------------|--------------|
| `kgen graph hash` | **HIGH** - Deterministic identification | LOW | RDF processing |
| `kgen artifact explain` | **HIGH** - Audit trail transparency | LOW | SPARQL queries |
| `kgen project lock` | **HIGH** - Reproducible builds | MEDIUM | Dependency resolution |

**Estimated Effort:** 1 week
**Success Criteria:** Complete artifact lifecycle with auditability

---

### 🟡 MEDIUM PRIORITY (Week 4)
**Management and operational commands for day-to-day usage**

| Command | Business Impact | Technical Complexity | Dependencies |
|---------|----------------|---------------------|--------------|
| `kgen templates ls` | **MEDIUM** - Developer productivity | LOW | File system scanning |
| `kgen templates show` | **MEDIUM** - Template discovery | LOW | Template metadata |
| `kgen rules ls` | **MEDIUM** - Rule management | LOW | Rule pack scanning |
| `kgen rules show` | **MEDIUM** - Rule inspection | LOW | Rule pack metadata |
| `kgen metrics export` | **MEDIUM** - Performance monitoring | MEDIUM | Metrics collection |

**Estimated Effort:** 1 week
**Success Criteria:** Complete developer experience for template and rule management

---

### 🟢 LOW PRIORITY (Week 5+)
**Nice-to-have features for optimization and maintenance**

| Command | Business Impact | Technical Complexity | Dependencies |
|---------|----------------|---------------------|--------------|
| `kgen cache gc` | **LOW** - Storage optimization | LOW | Cache management |
| `kgen cache show` | **LOW** - Cache inspection | LOW | Cache statistics |
| `kgen metrics report` | **LOW** - Advanced analytics | MEDIUM | Metrics analysis |

**Estimated Effort:** 0.5 weeks
**Success Criteria:** Complete PRD compliance with all 18 commands

---

## 📋 Detailed Implementation Plan

### Phase 1: CLI Foundation (Days 1-2)

#### 1.1 Create KGEN CLI Integration
**File:** `src/cli/kgen-cli.js`
```javascript
import { defineCommand } from "citty";

export const kgenCommand = defineCommand({
  meta: {
    name: "kgen",
    description: "Knowledge generation compiler - deterministic artifact generation",
    version: "1.0.0"
  },
  subCommands: {
    graph: createGraphCommands(),
    artifact: createArtifactCommands(),
    project: createProjectCommands(),
    templates: createTemplatesCommands(),
    rules: createRulesCommands(),
    cache: createCacheCommands(),
    metrics: createMetricsCommands()
  }
});
```

#### 1.2 Update Main CLI
**File:** `src/cli/index.js`
```javascript
// Add to lazyCommands
kgen: () => import('./kgen-cli.js').then(m => m.kgenCommand)
```

#### 1.3 Directory Structure
```
src/cli/kgen/
├── commands/
│   ├── graph/
│   │   ├── hash.js
│   │   ├── diff.js      # Migrate existing
│   │   └── index.js     # Migrate existing  
│   ├── artifact/
│   │   ├── generate.js  # NEW - CRITICAL
│   │   ├── drift.js     # NEW - CRITICAL
│   │   └── explain.js   # NEW - HIGH
│   ├── project/
│   │   ├── lock.js      # NEW - HIGH
│   │   └── attest.js    # NEW - CRITICAL
│   ├── templates/
│   │   ├── ls.js        # NEW - MEDIUM
│   │   └── show.js      # NEW - MEDIUM
│   ├── rules/
│   │   ├── ls.js        # NEW - MEDIUM
│   │   └── show.js      # NEW - MEDIUM
│   ├── cache/
│   │   ├── gc.js        # NEW - LOW
│   │   └── show.js      # NEW - LOW
│   └── metrics/
│       ├── export.js    # NEW - MEDIUM
│       └── report.js    # NEW - LOW
└── lib/
    ├── kgen-engine.js   # Core integration
    └── output-formatter.js
```

---

### Phase 2: Critical Commands (Days 3-10)

#### 2.1 `kgen artifact generate` (Days 3-5)
**Priority:** CRITICAL  
**Complexity:** HIGH  
**Implementation:**
```javascript
// Use existing assets:
// - src/lib/template-engine.js (Nunjucks rendering)
// - src/kgen/semantic/processor.js (RDF processing)
// - src/kgen/provenance/tracker.js (Provenance)

export const artifactGenerateCommand = {
  meta: {
    name: 'generate',
    description: 'Generate artifacts from knowledge graph deterministically'
  },
  args: {
    graph: { type: 'positional', required: true },
    template: { type: 'positional', required: true }
  },
  options: {
    'output-dir': { type: 'string', default: './out' },
    'lockfile': { type: 'string', description: 'Use specific lockfile' },
    'attest': { type: 'boolean', default: true },
    'rules': { type: 'string', description: 'Rule pack to apply' }
  }
};
```

#### 2.2 `kgen artifact drift` (Days 6-7)  
**Priority:** CRITICAL  
**Implementation:**
```javascript
// Use existing assets:
// - src/kgen/provenance/tracker.js (Integrity verification)
// - Hash comparison logic

export const artifactDriftCommand = {
  async run({ args, options }) {
    // 1. Read expected artifacts from provenance
    // 2. Calculate current file hashes
    // 3. Compare against expected hashes
    // 4. Exit with non-zero for CI/CD if drift detected
    
    const driftDetected = await detectDrift(options['output-dir']);
    process.exit(driftDetected ? 3 : 0); // PRD requirement: exit code 3
  }
};
```

#### 2.3 `kgen project attest` (Days 8-10)
**Priority:** CRITICAL  
**Implementation:**
```javascript
// Use existing assets:
// - src/kgen/provenance/compliance/logger.js
// - ZIP bundle creation

export const projectAttestCommand = {
  async run({ args, options }) {
    // 1. Collect all artifacts + .attest.json sidecars
    // 2. Create compliance bundle
    // 3. Generate cryptographic signatures
    // 4. Export as verifiable ZIP
  }
};
```

---

### Phase 3: High Priority Commands (Days 11-15)

#### 3.1 `kgen graph hash` (Days 11-12)
```javascript
// Use existing: src/kgen/rdf/index.js
// Add canonical hash generation

export const graphHashCommand = {
  async run({ args }) {
    const graph = await loadGraph(args.graph);
    const canonicalHash = generateCanonicalHash(graph);
    console.log(canonicalHash); // SHA256 output
  }
};
```

#### 3.2 `kgen artifact explain` (Days 13-14)
```javascript
// Use existing: src/kgen/provenance/queries/sparql.js
// Add provenance record retrieval

export const artifactExplainCommand = {
  async run({ args }) {
    const provenanceRecord = await getArtifactProvenance(args.filepath);
    console.log(JSON.stringify(provenanceRecord, null, 2));
  }
};
```

#### 3.3 `kgen project lock` (Day 15)
```javascript
export const projectLockCommand = {
  async run({ args }) {
    // 1. Calculate graph hash
    // 2. Pin template/rule versions
    // 3. Generate lockfile
    const lockfile = await generateLockfile(args.graph);
    await writeLockfile('kgen.lock.json', lockfile);
  }
};
```

---

### Phase 4: Medium Priority (Days 16-20)

#### Templates and Rules Commands
- Simple file system scanning and JSON output
- Template metadata extraction
- Rule pack introspection

#### Metrics Export
- Integration with existing performance tracking
- Structured JSONL export format

---

### Phase 5: Low Priority (Days 21+)

#### Cache Management
- File system cache operations
- Storage statistics

#### Advanced Metrics
- Performance analysis and reporting

---

## 🧪 Testing Strategy

### Unit Tests (Per Command)
```javascript
// Example test structure
describe('kgen artifact generate', () => {
  test('deterministic output', async () => {
    const result1 = await runCommand(['artifact', 'generate', 'graph.ttl', 'template.njk']);
    const result2 = await runCommand(['artifact', 'generate', 'graph.ttl', 'template.njk']);
    expect(result1.hash).toEqual(result2.hash); // PRD requirement
  });
  
  test('byte-for-byte identical', async () => {
    // PRD requirement: identical outputs
  });
});
```

### Integration Tests
```javascript
describe('kgen workflow integration', () => {
  test('generate → drift → attest workflow', async () => {
    await runCommand(['artifact', 'generate', 'api.ttl', 'service']);
    const drift = await runCommand(['artifact', 'drift']);
    expect(drift.exitCode).toBe(0); // No drift initially
    
    await runCommand(['project', 'attest']);
    // Verify attestation bundle created
  });
});
```

---

## 📊 Success Metrics

### Week 1 Targets
- ✅ KGEN CLI integrated into main CLI
- ✅ `kgen artifact generate` functional
- ✅ `kgen artifact drift` functional  
- ✅ Basic deterministic generation working

### Week 2 Targets  
- ✅ All CRITICAL commands implemented
- ✅ CI/CD integration ready (drift detection)
- ✅ Enterprise audit compliance (attestation)

### Week 3 Targets
- ✅ All HIGH priority commands implemented
- ✅ Complete artifact lifecycle functional
- ✅ Provenance and auditability complete

### Week 4 Targets
- ✅ Developer experience commands ready
- ✅ Template and rule management functional

### Week 5 Targets
- ✅ **FULL PRD COMPLIANCE** - All 18 commands implemented
- ✅ Comprehensive test coverage
- ✅ Performance benchmarks passing

---

## 🔧 Technical Dependencies

### Required Integration Points
1. **Template Engine:** `src/lib/template-engine.js` → KGEN artifact generation  
2. **RDF Processing:** `src/kgen/rdf/index.js` → Graph operations
3. **Provenance System:** `src/kgen/provenance/` → Audit trail
4. **SPARQL Engine:** `src/kgen/query/engine.js` → Graph queries
5. **Compliance Logger:** `src/kgen/provenance/compliance/logger.js` → Attestation

### External Dependencies (Already Available)
- **N3.js** - RDF processing ✅
- **Nunjucks** - Template rendering ✅  
- **SPARQL.js** - Query processing ✅
- **Crypto** - Hash generation ✅
- **Citty** - CLI framework ✅

---

## 🚀 Ready to Execute

This roadmap provides a **clear, prioritized path** to full KGEN PRD compliance:

- **Week 1-2:** Core functionality (generate, drift, attest)
- **Week 3:** Essential operations (hash, explain, lock)  
- **Week 4:** Management commands (templates, rules, metrics)
- **Week 5:** Complete compliance (cache, advanced metrics)

The implementation leverages **70% existing code assets** and focuses on **CLI integration and orchestration** rather than building from scratch.

**Next Step:** Begin Phase 1 - CLI Foundation setup.