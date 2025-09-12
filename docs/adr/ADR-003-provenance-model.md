# ADR-003: Provenance Model

## Status
**Accepted** - 2024-12-01

## Context

KGEN v1 must provide complete provenance tracking to enable:
- **Reproducible Builds**: Bit-for-bit identical artifacts across environments
- **Audit Trails**: Complete lineage from requirements to deployed artifacts  
- **Supply Chain Security**: Verifiable integrity of generated software
- **Debugging Support**: Root cause analysis for generation failures
- **Compliance Reporting**: Evidence for regulatory and governance requirements

Traditional build systems capture minimal provenance information, making it difficult to understand artifact origins or reproduce builds. Software supply chain attacks have demonstrated the critical importance of verifiable provenance for security and compliance.

The SLSA (Supply-chain Levels for Software Artifacts) framework provides industry standards for provenance tracking, while W3C PROV provides semantic models for provenance representation.

## Decision

**Implement comprehensive provenance tracking using PROV ontology with SLSA compliance.**

All generated artifacts will include cryptographically signed attestations containing:

### Provenance Data Model
```turtle
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix kgen: <https://kgen.dev/ontology#> .

# Generated artifact as Entity
kgen:artifact/api-service.ts
  a prov:Entity ;
  prov:wasGeneratedBy kgen:generation/20241201T120000Z ;
  prov:wasDerivedFrom kgen:template/rest-api.njk ;
  prov:wasDerivedFrom kgen:graph/domain-model.ttl ;
  kgen:contentHash "sha256:abc123..." ;
  kgen:generatedAt "2024-01-01T00:00:00.000Z"^^xsd:dateTime .

# Generation process as Activity  
kgen:generation/20241201T120000Z
  a prov:Activity ;
  prov:used kgen:template/rest-api.njk ;
  prov:used kgen:graph/domain-model.ttl ;
  prov:used kgen:rules/api-constraints.ttl ;
  prov:wasAssociatedWith kgen:agent/kgen-v1.0.0 ;
  kgen:deterministicBuildTime "2024-01-01T00:00:00.000Z"^^xsd:dateTime .

# KGEN engine as Agent
kgen:agent/kgen-v1.0.0
  a prov:SoftwareAgent ;
  prov:actedOnBehalfOf kgen:user/developer@org.com ;
  kgen:version "1.0.0" ;
  kgen:platform "linux-x64" ;
  kgen:nodeVersion "v20.0.0" .
```

### Attestation Structure
```json
{
  "@context": [
    "https://www.w3.org/ns/prov",
    "https://kgen.dev/contexts/v1"
  ],
  "@type": "kgen:GenerationAttestation",
  "artifact": {
    "path": "./generated/api-service.ts",
    "contentHash": "sha256:abc123...",
    "size": 2048,
    "mimeType": "text/typescript"
  },
  "generation": {
    "template": {
      "path": "_templates/rest-api.njk", 
      "contentHash": "sha256:def456...",
      "variables": ["serviceName", "endpoints", "schemas"]
    },
    "context": {
      "graph": "knowledge/domain-model.ttl",
      "graphHash": "sha256:ghi789...",
      "contextHash": "sha256:jkl012..."
    },
    "rules": [
      {
        "path": "rules/api-constraints.ttl",
        "contentHash": "sha256:mno345..."
      }
    ]
  },
  "environment": {
    "kgenVersion": "1.0.0",
    "nodeVersion": "v20.0.0",
    "platform": "linux-x64",
    "deterministicBuildTime": "2024-01-01T00:00:00.000Z",
    "gitCommit": "abc123def456..."
  },
  "verification": {
    "reproducible": true,
    "verificationCount": 3,
    "lastVerified": "2024-12-01T12:00:00.000Z"
  },
  "signature": {
    "keyId": "kgen-signing-key-v1",
    "algorithm": "Ed25519",
    "value": "base64-encoded-signature..."
  },
  "slsa": {
    "buildType": "https://kgen.dev/build-types/deterministic-v1",
    "builder": {
      "id": "https://kgen.dev/builders/kgen-v1"
    },
    "materials": [
      {
        "uri": "_templates/rest-api.njk",
        "digest": { "sha256": "def456..." }
      },
      {
        "uri": "knowledge/domain-model.ttl",
        "digest": { "sha256": "ghi789..." }
      }
    ]
  }
}
```

## Consequences

### Positive
✅ **Complete Lineage**: Full traceability from knowledge graphs to artifacts  
✅ **Cryptographic Integrity**: Tamper-evident attestations with digital signatures  
✅ **SLSA Compliance**: Industry-standard supply chain security framework  
✅ **Reproducible Verification**: Independent validation of generation processes  
✅ **Semantic Provenance**: Machine-readable provenance using standard ontologies  
✅ **Audit Support**: Comprehensive evidence for compliance and debugging  
✅ **Supply Chain Security**: Detection of unauthorized modifications or injections  

### Negative
❗ **Storage Overhead**: Attestation files increase artifact storage requirements  
❗ **Performance Impact**: Cryptographic operations add latency to generation  
❗ **Complexity**: Comprehensive provenance tracking increases system complexity  
❗ **Key Management**: Digital signing requires secure key generation and rotation  
❗ **Verification Overhead**: Independent reproduction requires additional compute resources  

### Mitigations
- **Compression**: Efficient encoding and compression of attestation data
- **Async Processing**: Background attestation generation to minimize latency
- **Simplified APIs**: High-level interfaces hide provenance complexity from users
- **Key Automation**: Automated key generation and rotation with secure defaults
- **Selective Verification**: Risk-based verification for high-priority artifacts only

## Implementation Details

### Provenance Collection
```javascript
class ProvenanceTracker {
  async recordGeneration(templatePath, contextData, outputPath) {
    const generationId = `kgen:generation/${this.deterministicTimestamp()}`;
    
    const provenance = {
      '@context': ['https://www.w3.org/ns/prov', 'https://kgen.dev/contexts/v1'],
      '@type': 'kgen:GenerationAttestation',
      generation: {
        id: generationId,
        template: await this.hashTemplate(templatePath),
        context: await this.hashContext(contextData), 
        environment: await this.captureEnvironment(),
        timestamp: this.deterministicBuildTime
      },
      artifact: await this.hashArtifact(outputPath)
    };
    
    return await this.signAttestation(provenance);
  }
}
```

### Git Integration
```javascript
// Store attestation in git-notes
async function storeAttestation(artifactHash, attestation) {
  const attestationData = JSON.stringify(attestation, null, 2);
  await git.addNote(artifactHash, attestationData, 'kgen-attestations');
  
  // Also store as separate blob for discoverability
  const attestationHash = await git.writeBlob(attestationData);
  await git.updateRef(`refs/kgen/attestations/${artifactHash}`, attestationHash);
}

// Retrieve attestation for verification
async function loadAttestation(artifactHash) {
  const attestationData = await git.getNote(artifactHash, 'kgen-attestations');
  return JSON.parse(attestationData);
}
```

### Verification Process
```javascript
class ProvenanceVerifier {
  async verifyArtifact(artifactPath) {
    const attestation = await this.loadAttestation(artifactPath);
    
    // Verify signature
    const signatureValid = await this.verifySignature(attestation);
    if (!signatureValid) {
      throw new Error('Invalid attestation signature');
    }
    
    // Verify reproducibility
    const reproduced = await this.reproduceGeneration(attestation);
    const reproducible = reproduced.contentHash === attestation.artifact.contentHash;
    
    return {
      verified: signatureValid && reproducible,
      attestation,
      reproduction: reproduced,
      timestamp: new Date().toISOString()
    };
  }
  
  async reproduceGeneration(attestation) {
    const template = await this.loadTemplate(attestation.generation.template);
    const context = await this.reconstructContext(attestation.generation.context);
    
    // Use same deterministic build time
    const originalBuildTime = this.deterministicBuildTime;
    this.deterministicBuildTime = attestation.environment.deterministicBuildTime;
    
    try {
      return await this.generateArtifact(template, context);
    } finally {
      this.deterministicBuildTime = originalBuildTime;
    }
  }
}
```

## Cryptographic Details

### Signing Infrastructure
- **Algorithm**: Ed25519 for fast signature generation and verification
- **Key Storage**: Environment variables or secure key management systems
- **Key Rotation**: Automated rotation with backward compatibility for verification
- **Multi-Signature**: Support for organizational signing workflows

### Content Addressing
- **Primary Hash**: SHA-256 for compatibility with Git and SLSA standards
- **Multihash**: Support for future algorithm transitions
- **Canonical Serialization**: Deterministic JSON serialization for consistent hashing
- **Merkle Trees**: Hierarchical hashing for large artifact collections

## Integration Points

### Git Storage
```bash
# Attestations stored in git-notes for discoverability
git notes --ref=kgen-attestations show <artifact-hash>

# Direct blob access for programmatic use  
git show refs/kgen/attestations/<artifact-hash>
```

### SLSA Integration
```yaml
# GitHub Actions integration
- name: Generate Artifacts with KGEN
  uses: kgen-dev/kgen-action@v1
  with:
    template: rest-api
    knowledge-graph: domain-model.ttl
    slsa-provenance: true
    
- name: Upload SLSA Provenance
  uses: slsa-framework/slsa-github-generator@v1
  with:
    attestation-path: generated/*.attest.json
```

### Policy Enforcement
```turtle
# SHACL shapes for provenance validation
kgen:ProvenanceRequiredShape
  a sh:NodeShape ;
  sh:targetClass kgen:GeneratedArtifact ;
  sh:property [
    sh:path kgen:hasAttestation ;
    sh:minCount 1 ;
    sh:message "All generated artifacts must include provenance attestations" ;
  ] ;
  sh:property [
    sh:path kgen:signatureVerified ;
    sh:hasValue true ;
    sh:message "Attestation signature must be valid" ;
  ] .
```

## Performance Considerations

### Optimization Strategies
- **Batch Processing**: Generate multiple attestations in single operations
- **Background Tasks**: Asynchronous attestation generation with eventual consistency
- **Caching**: Cache template and context hashes to avoid recomputation
- **Streaming**: Process large artifacts without loading entirely into memory

### Benchmarks
- **Attestation Generation**: < 50ms for typical artifacts
- **Signature Verification**: < 10ms per attestation
- **Reproduction Verification**: < 200ms for template re-rendering
- **Storage Overhead**: < 10% increase in total artifact size

## Related Decisions
- **ADR-001**: Git-First Workflow provides storage infrastructure for attestations
- **ADR-002**: SHACL-Only Validation enforces provenance requirements through shapes

## Security Considerations

### Threat Model
- **Supply Chain Injection**: Attestations detect unauthorized code injection
- **Template Tampering**: Hash verification prevents malicious template modifications  
- **Context Manipulation**: Signed attestations prevent context data tampering
- **Generation Environment**: Environment fingerprinting detects compromised build systems

### Security Controls
- **Code Signing**: All artifacts cryptographically signed with organizational keys
- **Secure Builds**: Deterministic generation in controlled, auditable environments
- **Key Protection**: Signing keys stored in hardware security modules or secure enclaves
- **Audit Logging**: All generation activities logged for security monitoring

## Review Date
**Next Review**: 2025-06-01  
**Trigger Events**: SLSA specification updates, cryptographic standard changes, or security incidents

---
**Decision Record Metadata**
- **Authors**: KGEN Security Team, Architecture Team
- **Reviewers**: Security Officers, Compliance Team, Platform Engineers
- **Status**: Accepted
- **Implementation**: Complete in KGEN v1.0.0
- **Dependencies**: Ed25519 signing, Git-notes, PROV ontology, SLSA framework