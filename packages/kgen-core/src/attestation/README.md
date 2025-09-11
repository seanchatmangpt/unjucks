# Attestation System for kgen

The attestation system provides immutable, cryptographically verifiable links from any generated artifact back to its origin template, rule, and source graph. It adapts the existing PROV-O provenance tracker to create lightweight .attest.json sidecar files.

## Features

- **🔒 Cryptographic Verification**: SHA-256 hash chains with optional blockchain anchoring
- **📋 .attest.json Sidecars**: Complete provenance metadata alongside each artifact
- **⚡ Fast Verification**: Optimized verification with caching and parallel processing
- **🔗 Immutable Links**: Unbreakable connection from artifact to source graph
- **📊 Template Versioning**: Automatic tracking of template and rule versions
- **🔍 Artifact Explanation**: Complete origin story for any generated file

## Core Components

### AttestationGenerator
Generates .attest.json sidecar files for artifacts with complete provenance information.

```javascript
import { AttestationGenerator } from '@kgen/core';

const generator = new AttestationGenerator();
await generator.initialize();

const result = await generator.generateAttestation(artifactPath, {
  templatePath: '/templates/component.njk',
  templateHash: 'abc123...',
  sourceGraph: { User: { name: 'string' } },
  variables: { name: 'UserProfile' },
  agent: 'kgen-react-generator'
});
```

### AttestationVerifier
High-performance verification of attestation chains and cryptographic integrity.

```javascript
import { AttestationVerifier } from '@kgen/core';

const verifier = new AttestationVerifier();

// Fast single verification
const result = await verifier.fastVerify(artifactPath);
console.log(result.verified); // true/false

// Batch verification
const batchResult = await verifier.batchVerify([path1, path2, path3]);
console.log(`${batchResult.verified}/${batchResult.total} verified`);
```

### AttestationCommands
CLI command handlers for artifact explanation and verification.

```javascript
import { AttestationCommands } from '@kgen/core';

const commands = new AttestationCommands();
await commands.initialize();

// Explain artifact origin
const explanation = await commands.explainArtifact(artifactPath);
console.log(explanation.explanation.origin);

// Verify artifact
const verification = await commands.verifyArtifact(artifactPath);
console.log(verification.success);
```

## CLI Integration

The system provides ready-to-use CLI commands:

```bash
# Explain artifact origin
kgen artifact explain src/components/UserProfile.jsx

# Verify artifact integrity
kgen artifact verify src/components/UserProfile.jsx

# List all attestations in directory
kgen artifact list src/

# Batch verify multiple artifacts
kgen artifact batch-verify src/**/*.jsx

# Get attestation statistics
kgen artifact stats src/
```

### CLI Integration Example

```javascript
import { createAttestationCLI } from '@kgen/core';

const attestationCLI = createAttestationCLI({
  enableBlockchainIntegrity: true,
  enableFastVerification: true
});

// In your CLI command handler
export async function artifactExplainCommand(artifactPath, options) {
  return await attestationCLI.explainCommand(artifactPath, options);
}
```

## .attest.json Format

Each generated artifact gets a corresponding .attest.json sidecar file:

```json
{
  "id": "attest-uuid-here",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "artifact": {
    "path": "/path/to/artifact.js",
    "name": "artifact.js",
    "hash": "sha256-hash-of-artifact",
    "size": 1234,
    "mimeType": "application/javascript"
  },
  "provenance": {
    "sourceGraph": {
      "User": { "name": "string", "email": "string" }
    },
    "templatePath": "/templates/component.njk",
    "templateHash": "sha256-template-hash",
    "templateVersion": "v12345678",
    "ruleVersion": "r87654321",
    "variables": { "name": "UserComponent" },
    "generatedAt": "2024-01-15T10:30:00Z",
    "generationAgent": "kgen-react-generator"
  },
  "integrity": {
    "hashAlgorithm": "sha256",
    "verificationChain": [
      {
        "type": "template",
        "path": "/templates/component.njk",
        "hash": "sha256-template-hash",
        "version": "v12345678"
      },
      {
        "type": "sourceGraph",
        "hash": "sha256-source-graph-hash",
        "entities": 2
      }
    ],
    "previousHash": "sha256-previous-attestation-hash",
    "chainIndex": 42
  },
  "templateLineage": {
    "templateFamily": "react-components",
    "derivedFrom": ["base-component"],
    "modifications": ["added-props"],
    "dependencies": ["react", "styled-components"]
  },
  "attestationHash": "sha256-attestation-hash",
  "blockchain": {
    "network": "ethereum",
    "transactionHash": "0x...",
    "blockNumber": 12345,
    "merkleRoot": "sha256-merkle-root"
  }
}
```

## Integration with Existing Provenance System

The attestation system reuses key components from the existing provenance tracker:

- **BlockchainAnchor**: For optional blockchain anchoring
- **Hash Chains**: For cryptographic integrity verification
- **Template Versioning**: For tracking changes to templates and rules

## Verification Process

1. **Artifact Hash**: Verify the artifact content matches the recorded hash
2. **Chain Integrity**: Verify the attestation fits correctly in the hash chain
3. **Template Lineage**: Verify template and rule versions are consistent
4. **Blockchain Anchor**: Optional verification against blockchain records

## Performance Features

- **Parallel Verification**: Batch operations use concurrent processing
- **Verification Caching**: Results are cached for repeated verifications
- **Fast Path**: Optimized verification skips expensive operations when possible
- **Incremental Updates**: Only recalculate changed elements

## Usage Examples

### Basic Generation and Verification

```javascript
import { createAttestationSystem } from '@kgen/core';

const system = await createAttestationSystem();

// Generate artifact with attestation
const context = {
  templatePath: '/templates/api-endpoint.njk',
  sourceGraph: { UserAPI: { endpoint: '/users' } },
  variables: { endpoint: 'users', method: 'GET' }
};

const attestation = await system.generateAttestation(
  'src/api/users.js',
  context
);

// Verify the artifact
const verification = await system.verifyAttestation('src/api/users.js');
console.log(verification.verified); // true

// Explain the artifact
const explanation = await system.explainArtifact('src/api/users.js');
console.log(explanation.explanation);
```

### Batch Operations

```javascript
// Batch verify all JavaScript files
const paths = glob.sync('src/**/*.js');
const results = await system.batchVerify(paths);

console.log(`Verified: ${results.verified}/${results.total}`);
console.log(`Success rate: ${Math.round(results.analysis.successRate * 100)}%`);

// Show failed verifications
const failures = results.results.filter(r => !r.verified);
failures.forEach(failure => {
  console.log(`❌ ${failure.artifactPath}: ${failure.reason}`);
});
```

### Template Change Detection

```javascript
// The system automatically detects when templates change
const oldVersion = await system.generateAttestation('artifact1.js', {
  templatePath: '/templates/component.njk'
});

// Modify the template file
await fs.writeFile('/templates/component.njk', 'Updated template content');

const newVersion = await system.generateAttestation('artifact2.js', {
  templatePath: '/templates/component.njk'
});

// Different template versions detected
console.log(oldVersion.attestation.provenance.templateVersion); // v12345678
console.log(newVersion.attestation.provenance.templateVersion); // v87654321
```

## Configuration

```javascript
const config = {
  // Cryptographic settings
  enableCryptographicHashing: true,
  hashAlgorithm: 'sha256',
  
  // Template tracking
  enableTemplateTracking: true,
  enableRuleVersioning: true,
  
  // Blockchain integration
  enableBlockchainIntegrity: process.env.KGEN_BLOCKCHAIN_ENABLED === 'true',
  blockchainNetwork: 'ethereum',
  
  // Performance settings
  enableFastVerification: true,
  cacheVerificationResults: true,
  maxConcurrentVerifications: 10,
  
  // Output settings
  sidecarExtension: '.attest.json',
  enablePrettyPrint: true
};

const system = await createAttestationSystem(config);
```

## Error Handling

The system provides detailed error information:

```javascript
try {
  const result = await system.verifyAttestation('missing-file.js');
  if (!result.verified) {
    console.log(`Verification failed: ${result.reason}`);
    if (result.verificationDetails) {
      console.log('Details:', result.verificationDetails);
    }
  }
} catch (error) {
  console.error('System error:', error.message);
}
```

## Testing

Comprehensive test suite covers:

- Attestation generation and verification
- Hash chain integrity
- Template version tracking
- Blockchain integration
- Performance scenarios
- Error conditions

```bash
npm test -- tests/kgen/attestation/
```

## Security Considerations

- All hashes use SHA-256 for cryptographic security
- Template versions are based on content hashes, not timestamps
- Chain integrity prevents tampering with attestation history
- Blockchain anchoring provides external validation
- Verification cache is cleared on template changes

## Migration from Provenance System

The attestation system is designed as a lightweight wrapper around the existing provenance tracker. Migration steps:

1. Install the updated kgen-core package
2. Import attestation components alongside existing provenance imports
3. Generate attestations during artifact creation
4. Use fast verification for routine checks
5. Keep existing provenance system for detailed audit trails

The two systems work together - attestations provide fast verification while the provenance tracker maintains complete audit trails.