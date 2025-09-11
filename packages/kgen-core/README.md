# KGEN Core - Enhanced Provenance System

## Goal 3: Perfect Auditability - Achieved

This package provides the enhanced provenance tracking system for KGEN, delivering comprehensive auditability with cryptographic attestations, PROV-O compliance, and enterprise-grade compliance features.

## Features

### ✅ Core Provenance Tracking
- **PROV-O Compliance**: Full W3C PROV-O standard implementation with RDF storage
- **Operation Lifecycle Tracking**: Complete tracking from operation start to completion
- **Entity Lineage**: Comprehensive data lineage with upstream/downstream tracing
- **Agent Attribution**: Full agent identification and accountability

### ✅ Enhanced Artifact Attestation
- **.attest.json Sidecar Generation**: Cryptographic attestations for every generated artifact
- **Template and Rule Tracking**: Complete governance with templateId and ruleIds
- **Graph Hash Verification**: Input/output graph integrity verification
- **Engine Version Tracking**: Complete version auditability

### ✅ Cryptographic Security
- **Digital Signatures**: RSA-SHA256 signatures for non-repudiation
- **Integrity Chains**: Blockchain-style hash chains for tamper detection
- **Key Management**: Automatic key generation and rotation
- **Hash Verification**: SHA256 integrity verification for all artifacts

### ✅ Compliance & Governance
- **Multi-Framework Support**: SOX, GDPR, HIPAA, ISO-27001, SOC-2, PCI-DSS
- **Compliance Bundles**: Comprehensive attestation bundles for auditors
- **Risk Assessment**: Automated risk analysis and recommendations
- **Retention Policies**: Configurable data retention and deletion

### ✅ Artifact Explanation
- **Complete Lineage Tracing**: Trace any artifact back to its origins
- **Dependency Analysis**: Complete dependency mapping and analysis
- **Quality Assessment**: Integrity, completeness, and accuracy scoring
- **Human-Readable Narratives**: Natural language explanations

## Quick Start

```javascript
import { createProvenanceTracker } from '@kgen/core/provenance';

// Create enhanced tracker
const tracker = createProvenanceTracker({
  enableAttestationGeneration: true,
  enableCryptographicSigning: true,
  complianceMode: 'enterprise'
});

await tracker.initialize();

// Track operation with full metadata
const context = await tracker.startOperation({
  type: 'template-generation',
  templateId: 'api-controller',
  templateVersion: '1.2.0',
  ruleIds: ['naming-convention', 'security-headers'],
  inputGraphHash: 'abc123...',
  user: { id: 'dev1', name: 'Developer' },
  sources: [{ id: 'schema', path: '/schemas/user.json' }]
});

// Complete with artifact generation
const result = await tracker.completeOperation(context.operationId, {
  status: 'success',
  outputGraphHash: 'def456...',
  generatedFiles: [{
    id: 'controller',
    path: './src/controllers/UserController.js',
    size: 1024,
    hash: 'file-hash...',
    type: 'javascript'
  }],
  validationResults: { errors: [], warnings: [] }
});

// .attest.json file automatically created alongside artifact
// Complete provenance chain recorded in RDF store
// Cryptographic signatures generated for integrity
```

## Artifact Explanation

```javascript
import { explainArtifact } from '@kgen/core/provenance';

// Explain any artifact from its .attest.json sidecar
const explanation = await explainArtifact('./src/UserService.js', {
  format: 'comprehensive',
  includeCompliance: true,
  includeVerification: true
});

console.log(explanation.narrative);
// "The artifact 'UserService.js' was generated using template 'service-template' 
//  by Developer on 2024-01-15. The generation process applied 3 compliance rules.
//  The artifact meets high quality standards with a score of 95.2/100."

console.log(explanation.lineage);
// Complete dependency graph and transformation path

console.log(explanation.compliance);
// Compliance assessment for configured frameworks
```

## Compliance Bundle Generation

```javascript
import { generateComplianceReport } from '@kgen/core/provenance';

// Generate comprehensive compliance bundle
const bundle = await generateComplianceReport({
  scope: 'full_audit',
  frameworks: ['SOX', 'GDPR', 'ISO-27001'],
  includeRiskAssessment: true,
  includeAuditTrail: true
});

// Complete attestation bundle with:
// - Provenance summary
// - Artifact attestations
// - Integrity verification
// - Template/rule compliance
// - Risk assessment
// - Executive summary
// - Cryptographic seal
```

## Chain Integrity Verification

```javascript
// Verify complete provenance chain integrity
const verification = await tracker.verifyChainIntegrity();

console.log(`Integrity Score: ${verification.integrityScore * 100}%`);
console.log(`Valid Links: ${verification.validLinks}/${verification.totalLinks}`);
console.log(`Signature Verification: ${verification.validSignatures}/${verification.signatureVerifications}`);

if (verification.brokenLinks.length > 0) {
  console.log('Broken links detected:', verification.brokenLinks);
}
```

## Directory Structure

```
packages/kgen-core/src/provenance/
├── tracker.js              # Enhanced provenance tracker
├── attestation/
│   └── generator.js        # .attest.json generation
├── compliance/
│   └── attestor.js         # Compliance bundle generation
├── crypto/
│   └── manager.js          # Cryptographic operations
├── queries/
│   └── explainer.js        # Artifact explanation
├── storage/
│   └── index.js            # Multi-backend storage
└── index.js                # Public API
```

## Configuration Options

```javascript
const config = {
  // Attestation features
  enableAttestationGeneration: true,
  enableCryptographicSigning: true,
  attestationFormat: 'json',
  
  // Tracking features
  trackTemplateIds: true,
  trackRuleIds: true,
  trackGraphHashes: true,
  trackEngineVersion: true,
  
  // Storage configuration
  storageBackend: 'file', // 'memory', 'file', 'database'
  enableCaching: true,
  maxCacheSize: 10000,
  
  // Compliance settings
  complianceMode: 'enterprise', // or specific frameworks
  retentionPeriod: '7years',
  
  // Cryptographic settings
  hashAlgorithm: 'sha256',
  signatureAlgorithm: 'RSA-SHA256',
  enableKeyRotation: false,
  
  // Performance settings
  batchSize: 100,
  enableCompression: true
};
```

## Testing

```bash
# Run provenance tests
npm test tests/kgen/provenance/

# Test specific functionality
npm test tests/kgen/provenance/tracker.test.js
```

## .attest.json Schema

Every generated artifact gets a comprehensive attestation sidecar:

```json
{
  "$schema": "https://kgen.enterprise/schemas/attestation/v1.0.json",
  "attestationId": "att-123...",
  "artifactId": "artifact-456...",
  "artifact": {
    "path": "./src/UserController.js",
    "hash": "sha256:abc123...",
    "size": 1024,
    "type": "javascript"
  },
  "generation": {
    "operationId": "op-789...",
    "operationType": "template-generation",
    "engine": { "name": "kgen", "version": "2.0.0" },
    "template": { "id": "controller-template", "version": "1.2.0" },
    "rules": [{ "id": "naming-convention" }, { "id": "security" }],
    "agent": { "id": "dev1", "name": "Developer" }
  },
  "provenance": {
    "graphHash": "def456...",
    "integrityHash": "ghi789...",
    "sources": [{ "id": "schema", "path": "/schemas/user.json" }]
  },
  "integrity": {
    "algorithm": "sha256",
    "artifactHash": "abc123...",
    "contextHash": "jkl012..."
  },
  "compliance": {
    "framework": "enterprise",
    "dataClassification": { "level": "internal" },
    "retention": { "period": "7years" }
  },
  "timestamps": {
    "generated": "2024-01-15T10:30:00Z",
    "operationStarted": "2024-01-15T10:29:45Z",
    "operationCompleted": "2024-01-15T10:30:00Z"
  },
  "signature": "RSA-SHA256:signature-data..."
}
```

## Goal 3 Achievement

✅ **Perfect Auditability Delivered**

- **Complete Artifact Tracing**: Every artifact can be traced back to its complete provenance graph
- **Cryptographic Attestations**: Every artifact has cryptographic proof of generation
- **PROV-O Compliance**: Full W3C standard compliance for enterprise interoperability
- **Multi-Framework Compliance**: Support for SOX, GDPR, HIPAA, and other regulations
- **Chain Integrity**: Blockchain-style integrity chains prevent tampering
- **Comprehensive Testing**: Full test suite ensuring reliability and correctness

The enhanced provenance system provides enterprise-grade auditability that satisfies regulatory requirements and enables complete transparency in the knowledge generation process.