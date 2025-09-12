# ADR-001: Use Git-First Workflow

## Status
**Accepted** - 2024-12-01

## Context

KGEN v1 requires a robust storage and provenance system that can:
- Provide verifiable provenance for all generated artifacts
- Enable deterministic storage with content addressing
- Support distributed collaboration and versioning
- Integrate seamlessly with existing development workflows
- Offer cryptographic integrity guarantees

Traditional file-based storage lacks the provenance and integrity features required for deterministic artifact generation. Database solutions add complexity and external dependencies that conflict with KGEN's self-contained design philosophy.

## Decision

**Use Git as the primary storage and provenance layer for KGEN v1.**

All artifacts, metadata, and attestations will be stored using Git's content-addressed object model:

### Storage Architecture
```
.git/objects/           # Content-addressed artifact storage
.git/notes/             # Cryptographic attestations and metadata
.git/refs/kgen/         # KGEN-specific references
.kgen/state/           # Drift detection baselines
.kgen/cache/           # Template compilation cache
```

### Implementation Details
- **Artifacts**: Stored as Git blobs with SHA-1 content addressing
- **Attestations**: Linked via git-notes with cryptographic signatures
- **Provenance**: Tracked through Git commit history and metadata
- **Distribution**: Leverages Git's existing push/pull mechanisms

## Consequences

### Positive
✅ **Verifiable Provenance**: Complete lineage from knowledge graph to artifact  
✅ **Content Addressing**: SHA-1 hashes provide tamper-evident storage  
✅ **Zero External Dependencies**: Git is ubiquitous in development environments  
✅ **Distributed Collaboration**: Native support for team-based workflows  
✅ **Efficient Storage**: Git's object compression reduces storage overhead  
✅ **Existing Tooling**: Leverages mature Git ecosystem and developer familiarity  

### Negative
❗ **SHA-1 Limitations**: Git's SHA-1 usage (though collision-resistant in practice)  
❗ **Learning Curve**: Developers must understand Git's object model for advanced usage  
❗ **Binary Storage**: Large binary artifacts may require Git LFS integration  
❗ **Repository Growth**: Frequent generation may increase repository size over time  

### Mitigations
- **SHA-256 Migration**: Prepare for Git's transition to SHA-256 hashing
- **Documentation**: Comprehensive guides for Git-first artifact management
- **LFS Integration**: Automatic detection and handling of large artifacts
- **Garbage Collection**: Automated cleanup of unreferenced objects

## Implementation Notes

### Core Git Operations
```javascript
// Store artifact as Git blob
const artifactHash = await git.writeBlob(artifactContent);

// Create attestation in git-notes
await git.addNote(artifactHash, attestationData);

// Reference artifacts through KGEN refs
await git.updateRef(`refs/kgen/artifacts/${templateName}`, artifactHash);
```

### Provenance Tracking
```javascript
// Link generation context to artifact
const provenanceData = {
  template: templateHash,
  context: contextHash,
  rules: rulesHash,
  timestamp: staticBuildTime,
  generator: 'kgen-v1.0.0'
};
```

### Performance Optimizations
- **Batch Operations**: Group related artifacts in single commits
- **Shallow Clones**: Support for minimal repository checkouts
- **Sparse Checkout**: Enable selective artifact retrieval
- **Index Caching**: Pre-compute artifact indexes for fast lookups

## Related Decisions
- **ADR-002**: SHACL-Only Validation complements git-first storage with semantic validation
- **ADR-003**: Provenance Model leverages git-notes for attestation storage

## Review Date
**Next Review**: 2025-03-01  
**Trigger Events**: Git SHA-256 migration, performance issues, or alternative storage requirements

---
**Decision Record Metadata**
- **Authors**: KGEN Architecture Team
- **Reviewers**: Platform Engineering, Security Team  
- **Status**: Accepted
- **Implementation**: Complete in KGEN v1.0.0