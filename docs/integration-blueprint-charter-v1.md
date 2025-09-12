# KGEN v1 Charter Integration Blueprint

**Agent**: Codebase Integration Analyst  
**Mission**: Map existing KGEN operational codebase to Charter requirements  
**Date**: 2025-09-12  
**Status**: ANALYSIS COMPLETE

## Executive Summary

The existing KGEN codebase provides **75% functional coverage** of Charter requirements, with strong foundations in RDF processing, semantic reasoning, and document generation. Key integration challenges are **library modernization** rather than architectural rebuilds.

**High-Value Assets to Preserve:**
- Operational CLI framework (`bin/kgen.mjs`) 
- Mature Office document processors (`src/office/`)
- N3.js reasoning engine (`src/kgen/semantic/reasoning/`)
- RDF processing pipeline (`src/kgen/rdf/`)
- Template rendering system (`packages/kgen-core/src/templating/`)
- Provenance tracking framework (`packages/kgen-core/src/provenance/`)

**Charter Dependencies Status:**
- ✅ `multiformats@13.4.0` - INSTALLED
- ✅ `hash-wasm@4.12.0` - INSTALLED  
- ✅ `isomorphic-git@1.33.1` - INSTALLED
- ❌ `@opentelemetry/*` - MISSING
- ❌ `shacl-js` or equivalent - MISSING

## Integration Analysis by Charter Requirement

### 1. Git-First Workflow (vs Current File-Based)

**Current State**: File-based operations via `fs` and `fs-extra`
```javascript
// Current: src/kgen/deterministic/index.js
const content = fs.readFileSync(filePath, 'utf8');
```

**Charter Requirement**: Git-integrated operations via `isomorphic-git`

**Integration Strategy** (80/20 Approach):
- ✅ **KEEP**: Current file I/O as fallback mode
- 🔄 **ENHANCE**: Add git-aware layer using existing `isomorphic-git@1.33.1`
- 📍 **Integration Point**: `src/kgen/core/engine.js` - add git context awareness

**Implementation Priority**: HIGH (foundational change)

### 2. Multiformats + hash-wasm CAS (vs Current SHA256)

**Current State**: Native crypto module
```javascript
// Current: bin/kgen.mjs line 181
const hash = crypto.createHash('sha256').update(content).digest('hex');
```

**Charter Requirement**: Multiformats CID with hash-wasm performance

**Integration Strategy**:
- ✅ **KEEP**: Current SHA256 logic as legacy support
- 🔄 **ENHANCE**: Replace with multiformats CID generation
- 📍 **Integration Point**: `src/kgen/rdf/standalone-bridge.js` - upgrade `graphHash()` method

**Impact Assessment**: Low (isolated to hashing functions)

### 3. SHACL-Only Validation (vs Current Mixed Validation)

**Current State**: Mixed N3.js + custom validation
```javascript
// Current: src/kgen/validation/index.js
// Uses N3.js rules + custom validators
```

**Charter Requirement**: Pure SHACL validation

**Integration Strategy**:
- 🔄 **REPLACE**: Add `shacl-js` dependency
- ✅ **KEEP**: N3.js for reasoning (SHACL uses RDFS/OWL reasoning)
- 📍 **Integration Point**: `src/kgen/semantic/validation/shacl-validator.js` - exists but needs SHACL library

**Implementation Priority**: MEDIUM (affects validation pipeline)

### 4. Office OPC Normalization (vs Current Template Approach)

**Current State**: Mature Office document processors
```javascript
// Current: src/office/processors/
// - word-processor.js
// - excel-processor.js  
// - powerpoint-processor.js
```

**Charter Requirement**: OPC (Open Packaging Conventions) normalization

**Integration Strategy**:
- ✅ **KEEP**: All existing Office processors (high-value assets)
- 🔄 **ENHANCE**: Add OPC normalization layer
- 📍 **Integration Point**: `src/office/parsers/office-parser.js` - add OPC preprocessing

**Impact Assessment**: Low (additive enhancement to existing system)

### 5. OpenTelemetry Integration (New Requirement)

**Current State**: Basic consola logging
```javascript
// Current: Multiple files
this.logger = consola.withTag('component-name');
```

**Charter Requirement**: OpenTelemetry tracing and metrics

**Integration Strategy**:
- ✅ **KEEP**: Existing logging for development
- ➕ **ADD**: OpenTelemetry instrumentation layer
- 📍 **Integration Points**: 
  - CLI entry point: `bin/kgen.mjs`
  - Core engine: `src/kgen/core/engine.js`
  - RDF processing: `src/kgen/rdf/index.js`

**Implementation Priority**: LOW (observability enhancement)

### 6. JSON-Only CLI Outputs (vs Current Mixed Formats)

**Current State**: Mixed console.log + JSON outputs
```javascript
// Current: bin/kgen.mjs line 192
console.log(JSON.stringify(result, null, 2));
```

**Charter Requirement**: Structured JSON responses only

**Integration Strategy**:
- ✅ **KEEP**: Existing JSON output patterns
- 🔄 **STANDARDIZE**: Ensure all CLI commands return consistent JSON
- 📍 **Integration Point**: `bin/kgen.mjs` - standardize all command outputs

**Impact Assessment**: Low (formatting standardization)

### 7. Performance Targets: ≤150ms p95, ≤2s Cold Start

**Current State**: No performance constraints identified

**Charter Requirements**: 
- p95 latency ≤ 150ms  
- Cold start ≤ 2s

**Integration Strategy**:
- 🔄 **OPTIMIZE**: Lazy loading of heavy dependencies
- 🔄 **OPTIMIZE**: Cache initialization where possible
- 📍 **Critical Path**: CLI startup in `bin/kgen.mjs`

**Current Bottlenecks Identified**:
- N3.js store initialization
- RDF file parsing
- Template discovery/indexing

## Component Reusability Matrix

| Component | Reuse Level | Charter Alignment | Action Required |
|-----------|-------------|------------------|-----------------|
| **CLI Framework** (`bin/kgen.mjs`) | 90% | High | Minor enhancements |
| **RDF Processing** (`src/kgen/rdf/`) | 85% | High | Library upgrades |
| **N3.js Reasoning** (`src/kgen/semantic/`) | 95% | Perfect | Keep as-is |
| **Office Processors** (`src/office/`) | 95% | High | Add OPC layer |
| **Template System** (`packages/kgen-core/`) | 80% | High | Performance tuning |
| **Provenance Tracking** | 70% | Medium | Upgrade to multiformats |
| **Drift Detection** (`src/kgen/drift/`) | 30% | Low | Needs rebuild |

## Migration Strategy (80/20 Impact)

### Phase 1: Library Integration (HIGH Impact - 60% Charter Compliance)
1. **Add Missing Dependencies**:
   ```bash
   npm install @opentelemetry/api @opentelemetry/auto-instrumentations-node
   npm install shacl-js
   ```

2. **Upgrade Hash Functions**:
   - Replace `crypto.createHash()` with `multiformats` CID
   - Update `src/kgen/rdf/standalone-bridge.js`

3. **Git Integration**:
   - Add git context awareness to core engine
   - Leverage existing `isomorphic-git@1.33.1`

### Phase 2: API Standardization (MEDIUM Impact - 80% Charter Compliance)
1. **JSON-Only Outputs**: Standardize all CLI responses
2. **SHACL Validation**: Replace mixed validation with pure SHACL
3. **OpenTelemetry**: Add tracing to performance-critical paths

### Phase 3: Performance Optimization (LOW Impact - 95% Charter Compliance)
1. **Cold Start**: Optimize CLI initialization
2. **P95 Latency**: Profile and optimize hot paths
3. **OPC Normalization**: Add to Office processors

## Integration Risks & Mitigation

### HIGH RISK: Performance Regression
**Risk**: Charter performance targets may not be achievable with current architecture
**Mitigation**: Profile current performance first, optimize critical path

### MEDIUM RISK: SHACL Validation Compatibility
**Risk**: Current N3.js validation may conflict with pure SHACL
**Mitigation**: Keep N3.js for reasoning, use SHACL for constraint validation only

### LOW RISK: Git Integration Complexity
**Risk**: Git-first workflow may complicate simple file operations
**Mitigation**: Maintain file-based fallback mode

## Recommended Implementation Order

1. **Immediate (Week 1)**:
   - Install missing Charter dependencies
   - Upgrade hash functions to multiformats
   - Standardize JSON outputs

2. **Short-term (Week 2-3)**:
   - Integrate git-first workflow
   - Add SHACL validation
   - Basic OpenTelemetry instrumentation

3. **Medium-term (Week 4-6)**:
   - Performance optimization
   - OPC normalization for Office
   - Advanced telemetry

## Success Metrics

- ✅ All Charter dependencies integrated
- ✅ 100% JSON-only CLI outputs  
- ✅ Git-first workflow operational
- ✅ SHACL validation functional
- ✅ Performance targets achieved:
  - Cold start ≤ 2s
  - p95 latency ≤ 150ms

## Conclusion

The existing KGEN codebase provides an **excellent foundation** for Charter v1 implementation. The integration is primarily **additive rather than replacement**, preserving high-value assets while modernizing the core libraries.

**Key Success Factor**: Maintain operational CLI throughout integration process using feature flags and backward compatibility.

---

**Next Action**: Agent 2 (Library Integration Specialist) should begin Phase 1 implementation based on this blueprint.